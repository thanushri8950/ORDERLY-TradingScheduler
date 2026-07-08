"""
main.py — ORDERLY Trading Scheduler Backend (v3)

ARCHITECTURE CHANGE FROM v2:
  Previously all three algorithms ran on ONE shared queue and only
  re-sorted it — meaning avg_wait/max_wait/starving_count were
  mathematically IDENTICAL across FCFS/Priority/Hybrid (these stats
  don't depend on sort order, only on queue composition).

  v3 gives each algorithm its OWN independent ready queue. All three
  queues receive IDENTICAL order arrivals every tick (same order_id,
  arrival_time, priority — a fair, controlled experiment). Each queue
  independently sorts by its own algorithm and dispatches up to
  PROCESSING_LIMIT orders. Because dispatch decisions differ, queue
  COMPOSITION diverges over time — so avg_wait, max_wait, and
  starving_count now genuinely differ per algorithm. This is the
  correct experimental design for comparing scheduling policies.

NEW FEATURES (v3):
  - Independent per-algorithm queues, metrics, cumulative stats
  - Server-computed "best" algorithm (avg_wait, epsilon + Hybrid
    tiebreak) — fixes the front-end floating-point BEST-badge bug
  - Gantt chart data: last 15 dispatches from the Hybrid queue
  - Process lifecycle counters (NEW/READY/RUNNING/DONE/REJECTED)
  - System Load % = arrived_this_tick / PROCESSING_LIMIT * 100
    (>100% = demand exceeds capacity = overload, ties directly to
    the "processing efficiency" objective)

TUNED PARAMETERS (fixes permanent-saturation bug from v2):
  PROCESSING_LIMIT = 5  (was 3)
  crash probability = 15% (was 20%)
  crash burst = 8-15 orders/tick (was 15-25)
  -> average arrival (3.42/tick) < capacity (5/tick): queue drains
     during normal ticks and recovers after crash spikes, instead of
     growing unboundedly and saturating all algorithms to identical
     P5-everything states within ~1 minute.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio, random, time, math
from collections import deque
from scheduler import fcfs, priority, hybrid

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

app = FastAPI(title="ORDERLY Trading Scheduler", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ── tuned constants ────────────────────────────────────────────────────
PROCESSING_LIMIT = 4     # orders dispatched per tick per queue — CPU throughput
                         # (deliberately tight vs avg arrival 3.425/tick so a
                         # small persistent backlog forms -> aging is ALWAYS
                         # active -> Hybrid always diverges from Priority)
QUEUE_MAX_SIZE   = 200   # finite buffer per queue — OS ready-queue capacity
CRASH_PROB       = 0.15
CRASH_BURST_MIN  = 8
CRASH_BURST_MAX  = 15
NORMAL_ARRIVAL   = 2
BEST_EPSILON     = 0.0005   # tolerance for "best" comparison
TICK_INTERVAL    = 1.25     # slower, readable market clock for charts/demos

order_id_ctr = 0
engine_tick = 0
current_price = 22000.0
latest_snapshot = None
market_task = None
connected_clients = set()

# ── three independent ready queues ───────────────────────────────────
queues = {"fcfs": [], "priority": [], "hybrid": []}
algos  = {"fcfs": fcfs, "priority": priority, "hybrid": hybrid}

# cumulative per-algorithm stats
cum = {k: {"processed": 0, "rejected": 0} for k in queues}

# Gantt history for Hybrid — last 15 dispatched orders
gantt_history = deque(maxlen=15)

runtime = {
    "benchmark_remaining": 0,
    "mode": "normal",        # normal | priority_only (disables aging -> Hybrid uses Priority fn)
    "crash_force": False,
    "auto_crash": False,     # if True, force a crash burst every AUTO_CRASH_INTERVAL ticks
}
AUTO_CRASH_INTERVAL = 18   # ticks (~18 seconds) between forced bursts in auto mode

session = {
    "total_ticks": 0,
    "crash_ticks": 0,
    "fcfs_waits": [], "priority_waits": [], "hybrid_waits": [],
    "load_history": [],
}

def _p95(lst):
    if not lst: return 0
    s = sorted(lst[-100:])  # rolling window — last 100 ticks
    return round(s[int(len(s)*0.95)], 4)

# ── real price data ────────────────────────────────────────────────────
_real_prices  = []
_price_index  = 0
_price_source = "GBM simulation (Geometric Brownian Motion)"

def fetch_real_prices():
    global _real_prices, _price_source
    if not YFINANCE_AVAILABLE:
        print("[ORDERLY] yfinance not installed — using GBM simulation")
        return
    try:
        ticker = yf.Ticker("^NSEI")
        hist   = ticker.history(period="5d", interval="1m")
        prices = hist["Close"].dropna().tolist()
        if prices:
            _real_prices  = prices
            _price_source = f"NIFTY50 historical (1-min, {len(prices)} pts, last 5 trading days)"
            print(f"[ORDERLY] Loaded {len(prices)} real NIFTY50 price points")
        else:
            print("[ORDERLY] yfinance returned no data — using GBM simulation")
    except Exception as e:
        print(f"[ORDERLY] yfinance fetch failed ({e}) — using GBM simulation")
        _real_prices = []

def next_price(current, is_crash):
    global _price_index
    if _real_prices:
        _price_index = (_price_index + 1) % len(_real_prices)
        p = _real_prices[_price_index]
        if is_crash:
            p *= random.uniform(0.96, 0.99)
        return round(p, 2)
    mu, dt = 0.0001, 1.0
    sigma  = 0.012 if not is_crash else 0.040
    z      = random.gauss(0, 1)
    new_p  = current * math.exp((mu - 0.5*sigma**2)*dt + sigma*math.sqrt(dt)*z)
    return round(max(new_p, 10.0), 2)

# ── control endpoints ──────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global current_price, market_task
    fetch_real_prices()
    current_price = _real_prices[0] if _real_prices else current_price
    market_task = asyncio.create_task(market_loop())

@app.get("/")
def root():
    return {
        "status": "ok",
        "real_data_active": YFINANCE_AVAILABLE and len(_real_prices) > 0,
        "price_source": _price_source,
        "queue_max_size": QUEUE_MAX_SIZE,
        "processing_limit": PROCESSING_LIMIT,
        "tick_interval": TICK_INTERVAL,
        "connected_clients": len(connected_clients),
        "engine_tick": engine_tick,
        "version": "3.0",
    }

@app.get("/benchmark/start")
def start_benchmark():
    runtime["benchmark_remaining"] = 35
    return {"started": True, "ticks": 35}

@app.get("/crash/trigger")
def trigger_crash():
    runtime["crash_force"] = True
    return {"crash": "triggered"}

@app.get("/crash/auto/{state}")
def set_auto_crash(state: str):
    """
    on  — forces a crash burst every AUTO_CRASH_INTERVAL ticks automatically.
          Useful for hands-free demo: dramatic spikes appear on a predictable
          cadence without needing to click Trigger Crash repeatedly.
    off — returns to pure 15% random crash probability.
    """
    if state in ("on", "off"):
        runtime["auto_crash"] = (state == "on")
        return {"auto_crash": runtime["auto_crash"]}
    return {"error": "use on or off"}

@app.get("/mode/{mode}")
def set_mode(mode: str):
    """
    normal        — Hybrid queue uses Priority + Aging
    priority_only — Hybrid queue uses pure Priority (aging disabled)
                     -> Starvation Demo: Hybrid's queue will now also
                        show starving low-priority orders, same as
                        the Priority queue
    """
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

    avg_f, avg_p, avg_h = avg(session["fcfs_waits"]), avg(session["priority_waits"]), avg(session["hybrid_waits"])

    return {
        "session": {
            "total_ticks":      session["total_ticks"],
            "crash_ticks":      session["crash_ticks"],
            "crash_percentage": round(session["crash_ticks"] / max(session["total_ticks"],1) * 100, 1),
            "avg_system_load":  avg(session["load_history"]),
        },
        "cumulative": {
            "fcfs":     cum["fcfs"],
            "priority": cum["priority"],
            "hybrid":   cum["hybrid"],
        },
        "average_wait": {"fcfs": avg_f, "priority": avg_p, "hybrid": avg_h},
        "p95_wait":     {"fcfs": p95(session["fcfs_waits"]), "priority": p95(session["priority_waits"]), "hybrid": p95(session["hybrid_waits"])},
        "hybrid_improvement": {
            "vs_fcfs_pct":     round((1 - avg_h/max(avg_f,0.001)) * 100, 1),
            "vs_priority_pct": round((1 - avg_h/max(avg_p,0.001)) * 100, 1),
        },
    }

@app.get("/reset")
def reset_stats():
    global engine_tick, current_price, latest_snapshot
    for k in ("fcfs_waits","priority_waits","hybrid_waits","load_history"):
        session[k].clear()
    session["total_ticks"] = session["crash_ticks"] = 0
    engine_tick = 0
    current_price = _real_prices[0] if _real_prices else 22000.0
    latest_snapshot = None
    for k in queues:
        queues[k].clear()
        cum[k] = {"processed": 0, "rejected": 0}
    gantt_history.clear()
    return {"reset": True}

# ── market engine + websocket fan-out ─────────────────────────────────

def build_market_snapshot():
    global order_id_ctr, engine_tick, current_price

    session["total_ticks"] += 1
    engine_tick += 1

    # ── crash determination ────────────────────────────────────
    auto_trigger = runtime["auto_crash"] and (engine_tick % AUTO_CRASH_INTERVAL == 0)
    force = runtime["benchmark_remaining"] > 0 or runtime["crash_force"] or auto_trigger
    if runtime["benchmark_remaining"] > 0:
        runtime["benchmark_remaining"] -= 1
    if runtime["crash_force"]:
        runtime["crash_force"] = False

    is_crash = force or (random.random() < CRASH_PROB)
    if is_crash:
        session["crash_ticks"] += 1

    # ── price ────────────────────────────────────────────────
    current_price = next_price(current_price, is_crash)

    # ── generate IDENTICAL new orders for all three queues ────
    num_orders = NORMAL_ARRIVAL if not is_crash else random.randint(CRASH_BURST_MIN, CRASH_BURST_MAX)
    new_orders = []
    now = time.time()
    for _ in range(num_orders):
        order_id_ctr += 1
        user_type = random.choices(["Retail","Institution","HFT"], weights=[0.60,0.30,0.10])[0]
        base_pri  = {"Retail": random.randint(1,2), "Institution": random.randint(3,4), "HFT": 5}[user_type]
        if is_crash and user_type == "Institution":
            base_pri = 5
        new_orders.append({
            "order_id":     order_id_ctr,
            "type":         random.choice(["BUY","SELL"]),
            "user_type":    user_type,
            "quantity":     random.randint(1, 200),
            "arrival_time": now,
            "priority":     base_pri,
        })

    # ── apply arrivals + dispatch independently per queue ─────
    per_algo = {}
    for name, algo_fn in algos.items():
        q = queues[name]

        # admit new orders (shared buffer cap per queue)
        rejected = 0
        for o in new_orders:
            if len(q) >= QUEUE_MAX_SIZE:
                rejected += 1
            else:
                q.append(o)
        cum[name]["rejected"] += rejected

        now = time.time()
        if not q:
            per_algo[name] = {
                "wait_time": 0, "avg_wait": 0, "max_wait": 0,
                "starving_count": 0, "queue_length": 0,
                "order_id": None, "dispatched": [], "rejected": rejected,
            }
            continue

        # choose algorithm fn (Hybrid -> Priority if starvation demo active)
        fn = algo_fn
        if name == "hybrid" and runtime["mode"] == "priority_only":
            fn = priority

        sorted_q = fn(q)
        waits = [now - o["arrival_time"] for o in sorted_q]

        metrics = {
            "wait_time":      round(waits[0], 4),
            "avg_wait":       round(sum(waits)/len(waits), 4),
            "max_wait":       round(max(waits), 4),
            "starving_count": sum(1 for w in waits if w > 5.0),
            "queue_length":   len(q),
            "order_id":       sorted_q[0]["order_id"],
            "rejected":       rejected,
        }

        # dispatch top PROCESSING_LIMIT
        dispatch = sorted_q[:PROCESSING_LIMIT]
        dispatch_ids = {o["order_id"] for o in dispatch}
        q[:] = [o for o in q if o["order_id"] not in dispatch_ids]
        cum[name]["processed"] += len(dispatch)
        metrics["dispatched"] = dispatch
        per_algo[name] = metrics

    # Gantt: record Hybrid's dispatches this tick
    for o in per_algo["hybrid"]["dispatched"]:
        gantt_history.append({
            "tick": engine_tick,
            "order_id":  o["order_id"],
            "priority":  o["priority"],
            "user_type": o["user_type"],
            "wait_at_dispatch": round(time.time() - o["arrival_time"], 2),
        })

    # record honest wait times
    session["fcfs_waits"].append(per_algo["fcfs"]["wait_time"])
    session["priority_waits"].append(per_algo["priority"]["wait_time"])
    session["hybrid_waits"].append(per_algo["hybrid"]["wait_time"])
    for k in ("fcfs_waits","priority_waits","hybrid_waits"):
        if len(session[k]) > 1000:
            session[k] = session[k][-1000:]

    # System load % = demand / capacity (rolling avg for stability)
    system_load = round(num_orders / PROCESSING_LIMIT * 100, 1)
    session["load_history"].append(system_load)
    if len(session["load_history"]) > 1000:
        session["load_history"] = session["load_history"][-1000:]
    system_load_avg = round(sum(session["load_history"][-20:]) / len(session["load_history"][-20:]), 1)

    # Live rolling P95 per algorithm (last 100 ticks)
    live_p95 = {
        "fcfs":     _p95(session["fcfs_waits"]),
        "priority": _p95(session["priority_waits"]),
        "hybrid":   _p95(session["hybrid_waits"]),
    }

    # ── determine BEST algorithm server-side (fixes badge bug) ─
    waits3 = {k: per_algo[k]["avg_wait"] for k in ("fcfs","priority","hybrid")}
    min_wait = min(waits3.values())
    # within epsilon of min -> tie; prefer hybrid > priority > fcfs
    tie_order = ["hybrid","priority","fcfs"]
    best = next(k for k in tie_order if abs(waits3[k] - min_wait) <= BEST_EPSILON)

    def ser(o):
        return {"order_id": o["order_id"], "type": o["type"], "user_type": o["user_type"],
                "quantity": o["quantity"], "priority": o["priority"]}

    def lane_payload(name):
        m = per_algo[name]
        sorted_remaining = algos[name](queues[name])[:8] if queues[name] else []
        if name == "hybrid" and runtime["mode"] == "priority_only" and queues[name]:
            sorted_remaining = priority(queues[name])[:8]
        return {
            "wait_time": m["wait_time"], "avg_wait": m["avg_wait"], "max_wait": m["max_wait"],
            "starving_count": m["starving_count"], "queue_length": m["queue_length"],
            "order_id": m["order_id"],
            "p95_wait": live_p95[name],
            "cumulative_processed": cum[name]["processed"],
            "cumulative_rejected":  cum[name]["rejected"],
        }, [ser(o) for o in sorted_remaining]

    fcfs_payload, fcfs_q       = lane_payload("fcfs")
    priority_payload, prio_q   = lane_payload("priority")
    hybrid_payload, hyb_q      = lane_payload("hybrid")

    # Order book — sample from hybrid queue (representative)
    recent = queues["hybrid"][-8:]

    total_processed = sum(len(per_algo[k]["dispatched"]) for k in per_algo)
    overflow = sum(per_algo[k]["rejected"] for k in per_algo)

    return {
        "price":        current_price,
        "crash":        is_crash,
        "mode":         runtime["mode"],
        "best":         best,
        "system_load":  system_load,
        "system_load_avg": system_load_avg,
        "queue_length": len(queues["hybrid"]),
        "overflow":     overflow,
        "server_tick":   engine_tick,
        "tick_interval": TICK_INTERVAL,
        "connected_clients": len(connected_clients),

        "fcfs":     fcfs_payload,
        "priority": priority_payload,
        "hybrid":   hybrid_payload,

        "fcfs_queue":     fcfs_q,
        "priority_queue": prio_q,
        "hybrid_queue":   hyb_q,

        "buy_orders":  [ser(o) for o in recent if o["type"]=="BUY"],
        "sell_orders": [ser(o) for o in recent if o["type"]=="SELL"],

        "gantt": list(gantt_history),

        "tick_stats": {
            "arrived":            num_orders,
            "processed":          total_processed,
            "processed_fcfs":     len(per_algo["fcfs"]["dispatched"]),
            "processed_priority": len(per_algo["priority"]["dispatched"]),
            "processed_hybrid":   len(per_algo["hybrid"]["dispatched"]),
            "overflow":           overflow,
            "rejected_hybrid":    per_algo["hybrid"]["rejected"],
        },
    }


async def market_loop():
    global latest_snapshot
    while True:
        latest_snapshot = build_market_snapshot()
        stale = []
        for ws in list(connected_clients):
            try:
                await ws.send_json(latest_snapshot)
            except (WebSocketDisconnect, RuntimeError):
                stale.append(ws)
        for ws in stale:
            connected_clients.discard(ws)
        await asyncio.sleep(TICK_INTERVAL)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    if latest_snapshot:
        await ws.send_json(latest_snapshot)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        connected_clients.discard(ws)
    except RuntimeError:
        connected_clients.discard(ws)

        await asyncio.sleep(1)
