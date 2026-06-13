"""
main.py — ORDERLY Trading Scheduler Backend (Final)

Critical parameter change from v3.0:
  NORMAL_ARRIVAL   = 5   (was 2)
  PROCESSING_LIMIT = 4   (was 5)

Why this matters:
  With NORMAL_ARRIVAL=2 and PROCESSING_LIMIT=5, the queue averaged
  <2 items. Both FCFS and Priority dispatched ALL items every tick,
  making their metrics mathematically identical (sort order doesn't
  matter when you process everything). This caused the "2 lines on
  chart" and "identical FCFS/Priority" bugs.

  With NORMAL_ARRIVAL=5 and PROCESSING_LIMIT=4, the queue grows
  steadily. At any given tick there are 8-20 items and algorithms
  must choose which 4 to dispatch. Sort order now determines WHICH
  orders get served, causing genuine metric divergence:

    FCFS:     dispatches 4 OLDEST orders (may be low-priority)
    Priority: dispatches 4 HIGHEST priority (ignores age)
    Hybrid:   dispatches 4 highest EFFECTIVE priority (age-boosted)

  After 15-20 ticks: Priority queue fills with starving P1/P2 orders
  that never get dispatched, max_wait grows. Hybrid promotes them via
  aging, keeping max_wait bounded. FCFS shows intermediate behavior.

WebSocket payload additions:
  - queue_length at top level (hybrid queue length)
  - overflow at top level
  - tick_stats.overflow field
  - gantt array (last 20 Hybrid dispatches with tick/priority/wait)
  - p95_approx per algorithm (running approximation without /stats call)
  - last_dispatched per algorithm (for divergence proof panel)
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio, random, time, math
from collections import deque
from scheduler import fcfs, priority, hybrid, STARVATION_THRESHOLD

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

app = FastAPI(title="ORDERLY Trading Scheduler", version="3.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ── constants ──────────────────────────────────────────────────────────
PROCESSING_LIMIT = 4      # orders dispatched per tick — must be < NORMAL_ARRIVAL
QUEUE_MAX_SIZE   = 200    # finite buffer — OS ready-queue capacity
NORMAL_ARRIVAL   = 5      # orders per normal tick — queue grows steadily
CRASH_BURST_MIN  = 14
CRASH_BURST_MAX  = 22
CRASH_PROB       = 0.12   # less frequent but more dramatic bursts
BEST_EPSILON     = 0.001

order_id_ctr = 0

# ── three independent ready queues ────────────────────────────────────
queues = {"fcfs": [], "priority": [], "hybrid": []}
algos  = {"fcfs": fcfs, "priority": priority, "hybrid": hybrid}
cum    = {k: {"processed": 0, "rejected": 0} for k in queues}

# Gantt: last 20 Hybrid dispatches
gantt_history = deque(maxlen=20)

# Rolling wait lists for P95 approximation (last 200 ticks)
wait_history = {"fcfs": deque(maxlen=200), "priority": deque(maxlen=200), "hybrid": deque(maxlen=200)}

runtime = {
    "benchmark_remaining": 0,
    "mode":        "normal",
    "crash_force": False,
}

session = {
    "total_ticks": 0,
    "crash_ticks": 0,
    "fcfs_waits":      [],
    "priority_waits":  [],
    "hybrid_waits":    [],
    "load_history":    [],
}

# ── price data ─────────────────────────────────────────────────────────
_real_prices  = []
_price_index  = 0
_price_source = "GBM simulation (Geometric Brownian Motion)"

def fetch_real_prices():
    global _real_prices, _price_source
    if not YFINANCE_AVAILABLE:
        print("[ORDERLY] yfinance not installed — using GBM")
        return
    try:
        ticker = yf.Ticker("^NSEI")
        hist   = ticker.history(period="5d", interval="1m")
        prices = hist["Close"].dropna().tolist()
        if prices:
            _real_prices  = prices
            _price_source = f"NIFTY50 1-min historical ({len(prices)} pts, last 5 days)"
            print(f"[ORDERLY] Loaded {len(prices)} NIFTY50 price points")
        else:
            print("[ORDERLY] yfinance returned no data — using GBM")
    except Exception as e:
        print(f"[ORDERLY] yfinance failed ({e}) — using GBM")

def next_price(current, is_crash):
    global _price_index
    if _real_prices:
        _price_index = (_price_index + 1) % len(_real_prices)
        p = _real_prices[_price_index]
        if is_crash:
            p *= random.uniform(0.96, 0.99)
        return round(p, 2)
    sigma = 0.040 if is_crash else 0.012
    z     = random.gauss(0, 1)
    new_p = current * math.exp((0.0001 - 0.5*sigma**2) + sigma*z)
    return round(max(new_p, 10.0), 2)

def p95_approx(dq: deque) -> float:
    """Fast P95 from rolling deque — no full sort needed for display."""
    if not dq:
        return 0.0
    lst = sorted(dq)
    return round(lst[int(len(lst) * 0.95)], 4)

# ── startup ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    fetch_real_prices()

# ── REST endpoints ─────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status":           "ok",
        "real_data_active": YFINANCE_AVAILABLE and len(_real_prices) > 0,
        "price_source":     _price_source,
        "queue_max_size":   QUEUE_MAX_SIZE,
        "processing_limit": PROCESSING_LIMIT,
        "normal_arrival":   NORMAL_ARRIVAL,
        "version":          "3.1",
    }

@app.get("/benchmark/start")
def start_benchmark():
    runtime["benchmark_remaining"] = 40
    return {"started": True, "ticks": 40}

@app.get("/crash/trigger")
def trigger_crash():
    runtime["crash_force"] = True
    return {"crash": "triggered"}

@app.get("/mode/{mode}")
def set_mode(mode: str):
    if mode in ("normal", "priority_only"):
        runtime["mode"] = mode
        return {"mode": mode}
    return {"error": "unknown mode"}

@app.get("/stats")
def get_stats():
    def avg(lst): return round(sum(lst)/len(lst), 4) if lst else 0
    def p95(lst):
        if not lst: return 0
        s = sorted(lst)
        return round(s[int(len(s)*0.95)], 4)

    avg_f = avg(session["fcfs_waits"])
    avg_p = avg(session["priority_waits"])
    avg_h = avg(session["hybrid_waits"])

    return {
        "session": {
            "total_ticks":      session["total_ticks"],
            "crash_ticks":      session["crash_ticks"],
            "crash_percentage": round(session["crash_ticks"] / max(session["total_ticks"], 1) * 100, 1),
            "avg_system_load":  avg(session["load_history"]),
        },
        "cumulative": {k: cum[k] for k in cum},
        "average_wait":  {"fcfs": avg_f, "priority": avg_p, "hybrid": avg_h},
        "p95_wait":      {"fcfs": p95(session["fcfs_waits"]),
                          "priority": p95(session["priority_waits"]),
                          "hybrid":   p95(session["hybrid_waits"])},
        "hybrid_improvement": {
            "vs_fcfs_pct":     round((1 - avg_h / max(avg_f, 0.001)) * 100, 1),
            "vs_priority_pct": round((1 - avg_h / max(avg_p, 0.001)) * 100, 1),
        },
    }

@app.get("/reset")
def reset_stats():
    for k in ("fcfs_waits", "priority_waits", "hybrid_waits", "load_history"):
        session[k].clear()
    session["total_ticks"] = session["crash_ticks"] = 0
    for k in queues:
        queues[k].clear()
        cum[k] = {"processed": 0, "rejected": 0}
        wait_history[k].clear()
    gantt_history.clear()
    return {"reset": True}

# ── WebSocket main loop ────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global order_id_ctr
    await ws.accept()
    price    = _real_prices[0] if _real_prices else 22000.0
    tick_num = 0

    try:
        while True:
            session["total_ticks"] += 1
            tick_num += 1

            # ── crash determination ────────────────────────────────
            force = runtime["benchmark_remaining"] > 0 or runtime["crash_force"]
            if runtime["benchmark_remaining"] > 0:
                runtime["benchmark_remaining"] -= 1
            if runtime["crash_force"]:
                runtime["crash_force"] = False

            is_crash = force or (random.random() < CRASH_PROB)
            if is_crash:
                session["crash_ticks"] += 1

            # ── price ──────────────────────────────────────────────
            price = next_price(price, is_crash)

            # ── generate identical new orders for all queues ───────
            num_orders = NORMAL_ARRIVAL if not is_crash else random.randint(CRASH_BURST_MIN, CRASH_BURST_MAX)
            new_orders = []
            for _ in range(num_orders):
                order_id_ctr += 1
                user_type = random.choices(
                    ["Retail", "Institution", "HFT"],
                    weights=[0.60, 0.30, 0.10]
                )[0]
                base_pri = {
                    "Retail":      random.randint(1, 2),
                    "Institution": random.randint(3, 4),
                    "HFT":         5,
                }[user_type]
                if is_crash and user_type == "Institution":
                    base_pri = 5
                new_orders.append({
                    "order_id":     order_id_ctr,
                    "type":         random.choice(["BUY", "SELL"]),
                    "user_type":    user_type,
                    "quantity":     random.randint(1, 200),
                    "arrival_time": time.time(),
                    "priority":     base_pri,
                })

            # ── dispatch independently per algorithm ───────────────
            per_algo = {}
            for name, algo_fn in algos.items():
                q = queues[name]

                # admit new orders up to buffer cap
                rejected = 0
                for o in new_orders:
                    if len(q) >= QUEUE_MAX_SIZE:
                        rejected += 1
                    else:
                        q.append(dict(o))   # copy so queues are independent
                cum[name]["rejected"] += rejected

                now = time.time()
                if not q:
                    per_algo[name] = {
                        "wait_time": 0, "avg_wait": 0, "max_wait": 0,
                        "starving_count": 0, "queue_length": 0,
                        "order_id": None, "dispatched": [], "rejected": rejected,
                    }
                    continue

                # select algorithm (starvation demo overrides Hybrid)
                fn = algo_fn
                if name == "hybrid" and runtime["mode"] == "priority_only":
                    fn = priority

                sorted_q = fn(q)
                waits    = [now - o["arrival_time"] for o in sorted_q]

                metrics = {
                    "wait_time":      round(waits[0], 4),
                    "avg_wait":       round(sum(waits) / len(waits), 4),
                    "max_wait":       round(max(waits), 4),
                    "starving_count": sum(1 for w in waits if w > STARVATION_THRESHOLD),
                    "queue_length":   len(q),
                    "order_id":       sorted_q[0]["order_id"],
                    "rejected":       rejected,
                }

                # dispatch top PROCESSING_LIMIT
                dispatch     = sorted_q[:PROCESSING_LIMIT]
                dispatch_ids = {o["order_id"] for o in dispatch}
                q[:]         = [o for o in q if o["order_id"] not in dispatch_ids]
                cum[name]["processed"] += len(dispatch)
                metrics["dispatched"] = dispatch
                per_algo[name] = metrics

                # rolling wait history for P95
                wait_history[name].append(metrics["wait_time"])

            # ── Gantt: record Hybrid dispatches ───────────────────
            now_t = time.time()
            for o in per_algo["hybrid"]["dispatched"]:
                gantt_history.append({
                    "tick":             tick_num,
                    "order_id":         o["order_id"],
                    "priority":         o["priority"],
                    "user_type":        o["user_type"],
                    "wait_at_dispatch": round(now_t - o["arrival_time"], 3),
                })

            # ── session wait lists ─────────────────────────────────
            session["fcfs_waits"].append(per_algo["fcfs"]["wait_time"])
            session["priority_waits"].append(per_algo["priority"]["wait_time"])
            session["hybrid_waits"].append(per_algo["hybrid"]["wait_time"])
            for k in ("fcfs_waits", "priority_waits", "hybrid_waits"):
                if len(session[k]) > 2000:
                    session[k] = session[k][-2000:]

            system_load = round(num_orders / PROCESSING_LIMIT * 100, 1)
            session["load_history"].append(system_load)
            if len(session["load_history"]) > 2000:
                session["load_history"] = session["load_history"][-2000:]

            # ── best algorithm (server-side, epsilon-tolerant) ─────
            waits3   = {k: per_algo[k]["avg_wait"] for k in ("fcfs", "priority", "hybrid")}
            min_wait = min(waits3.values())
            best     = next(
                k for k in ["hybrid", "priority", "fcfs"]
                if abs(waits3[k] - min_wait) <= BEST_EPSILON
            )

            # ── serializers ───────────────────────────────────────
            def ser_basic(o):
                return {
                    "order_id":  o["order_id"],
                    "type":      o["type"],
                    "user_type": o["user_type"],
                    "quantity":  o["quantity"],
                    "priority":  o["priority"],
                }

            def ser_hybrid(o):
                """Hybrid orders include aging metadata."""
                now_s  = time.time()
                excess = max(0.0, (now_s - o["arrival_time"]) - 1.5)
                boost  = min(excess * 0.8, 5.0 - o["priority"])
                return {
                    "order_id":         o["order_id"],
                    "type":             o["type"],
                    "user_type":        o["user_type"],
                    "quantity":         o["quantity"],
                    "priority":         o["priority"],
                    "effective_priority": round(o["priority"] + boost, 2),
                    "aging_boost":      round(boost, 2),
                    "wait_age":         round(now_s - o["arrival_time"], 2),
                }

            def lane_payload(name):
                m  = per_algo[name]
                fn = algos[name]
                if name == "hybrid" and runtime["mode"] == "priority_only":
                    fn = priority

                remaining = fn(queues[name])[:8] if queues[name] else []

                ser = ser_hybrid if name == "hybrid" else ser_basic
                return {
                    "wait_time":            m["wait_time"],
                    "avg_wait":             m["avg_wait"],
                    "max_wait":             m["max_wait"],
                    "starving_count":       m["starving_count"],
                    "queue_length":         m["queue_length"],
                    "order_id":             m["order_id"],
                    "cumulative_processed": cum[name]["processed"],
                    "cumulative_rejected":  cum[name]["rejected"],
                    "p95":                  p95_approx(wait_history[name]),
                    "last_dispatched":      [ser_basic(o) for o in m["dispatched"]],
                }, [ser(o) for o in remaining]

            fcfs_payload,     fcfs_q = lane_payload("fcfs")
            priority_payload, prio_q = lane_payload("priority")
            hybrid_payload,   hyb_q  = lane_payload("hybrid")

            # order book sample from hybrid queue tail
            recent = queues["hybrid"][-10:]

            overflow_this_tick = sum(per_algo[k]["rejected"] for k in per_algo)

            await ws.send_json({
                # top-level
                "price":       price,
                "crash":       is_crash,
                "mode":        runtime["mode"],
                "best":        best,
                "system_load": system_load,
                "queue_length": len(queues["hybrid"]),
                "overflow":    overflow_this_tick,
                "tick":        tick_num,

                # per-algorithm payloads
                "fcfs":     fcfs_payload,
                "priority": priority_payload,
                "hybrid":   hybrid_payload,

                # sorted queue previews
                "fcfs_queue":     fcfs_q,
                "priority_queue": prio_q,
                "hybrid_queue":   hyb_q,

                # order book
                "buy_orders":  [ser_basic(o) for o in recent if o["type"] == "BUY"],
                "sell_orders": [ser_basic(o) for o in recent if o["type"] == "SELL"],

                # gantt
                "gantt": list(gantt_history),

                # tick stats
                "tick_stats": {
                    "arrived":            num_orders,
                    "processed":          sum(len(per_algo[k]["dispatched"]) for k in per_algo),
                    "processed_fcfs":     len(per_algo["fcfs"]["dispatched"]),
                    "processed_priority": len(per_algo["priority"]["dispatched"]),
                    "processed_hybrid":   len(per_algo["hybrid"]["dispatched"]),
                    "overflow":           overflow_this_tick,
                    "system_load":        system_load,
                },
            })

            await asyncio.sleep(1)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[ORDERLY] WebSocket error: {e}")