from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio, random, time
from scheduler import fcfs, priority, hybrid

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

order_queue = []
order_id_counter = 0

# Runtime control flags — toggled by UI buttons
runtime_flags = {
    "benchmark_ticks_remaining": 0,   # >0 means force crash mode
    "mode": "normal",                  # "normal" | "priority_only"
}

session_stats = {
    "total_ticks": 0,
    "crash_ticks": 0,
    "total_processed": 0,
    "fcfs_waits": [],
    "priority_waits": [],
    "hybrid_waits": [],
    "max_queue": 0,
}

# ── Control endpoints ────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/benchmark/start")
def start_benchmark():
    """Force crash mode for 35 ticks so the UI benchmark button gets real data."""
    runtime_flags["benchmark_ticks_remaining"] = 35
    return {"started": True, "ticks": 35}

@app.get("/mode/{mode}")
def set_mode(mode: str):
    """
    Switch scheduler behavior:
      normal        — Hybrid (priority + aging) for order dispatch
      priority_only — Pure priority, no aging (starvation demo)
    """
    if mode in ("normal", "priority_only"):
        runtime_flags["mode"] = mode
        return {"mode": mode}
    return {"error": "unknown mode"}

@app.get("/stats")
def get_stats():
    """Return real measured session statistics — used by benchmark button."""
    def avg(lst): return round(sum(lst) / len(lst), 4) if lst else 0
    def p95(lst):
        if not lst: return 0
        s = sorted(lst)
        return round(s[int(len(s) * 0.95)], 4)

    avg_fcfs     = avg(session_stats["fcfs_waits"])
    avg_hybrid   = avg(session_stats["hybrid_waits"])
    avg_priority = avg(session_stats["priority_waits"])

    return {
        "session": {
            "total_ticks":        session_stats["total_ticks"],
            "crash_ticks":        session_stats["crash_ticks"],
            "crash_percentage":   round(session_stats["crash_ticks"] / max(session_stats["total_ticks"], 1) * 100, 1),
            "total_orders_processed": session_stats["total_processed"],
            "peak_queue_depth":   session_stats["max_queue"],
        },
        "average_wait_time": {
            "fcfs":     avg_fcfs,
            "priority": avg_priority,
            "hybrid":   avg_hybrid,
        },
        "p95_wait_time": {
            "fcfs":     p95(session_stats["fcfs_waits"]),
            "priority": p95(session_stats["priority_waits"]),
            "hybrid":   p95(session_stats["hybrid_waits"]),
        },
        "hybrid_improvement": {
            "vs_fcfs_pct":     round((1 - avg_hybrid / max(avg_fcfs,     0.001)) * 100, 1),
            "vs_priority_pct": round((1 - avg_hybrid / max(avg_priority, 0.001)) * 100, 1),
        },
    }

# ── WebSocket main loop ──────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global order_id_counter
    await ws.accept()
    price = 100.0

    while True:
        session_stats["total_ticks"] += 1

        # Determine if this tick is a crash
        # Benchmark mode forces crash; otherwise 20% random probability
        force_crash = runtime_flags["benchmark_ticks_remaining"] > 0
        if force_crash:
            runtime_flags["benchmark_ticks_remaining"] -= 1

        is_crash = force_crash or (random.random() < 0.2)
        if is_crash:
            session_stats["crash_ticks"] += 1

        # Price movement — realistic Gaussian walk with crash dip
        price += random.gauss(0, 1.2)
        if is_crash:
            price += random.uniform(-10, -4)
        price = max(price, 10.0)

        # Order generation
        num_orders = 2 if not is_crash else random.randint(15, 25)

        for _ in range(num_orders):
            order_id_counter += 1
            user_type = random.choices(
                ["Retail", "Institution", "HFT"],
                weights=[0.6, 0.3, 0.1]
            )[0]

            base_priority = {
                "Retail":      random.randint(1, 2),
                "Institution": random.randint(3, 4),
                "HFT":         5,
            }[user_type]

            # Institutions escalate to P5 during crash
            if is_crash and user_type == "Institution":
                base_priority = 5

            order_queue.append({
                "order_id":    order_id_counter,
                "type":        random.choice(["BUY", "SELL"]),
                "user_type":   user_type,
                "quantity":    random.randint(1, 100),
                "arrival_time": time.time(),
                "priority":    base_priority,
            })

        # Fixed processing capacity — the OS scheduling constraint
        PROCESSING_LIMIT = 3
        processed_count = min(PROCESSING_LIMIT, len(order_queue))
        for _ in range(processed_count):
            order_queue.pop(0)
        session_stats["total_processed"] += processed_count

        if len(order_queue) > session_stats["max_queue"]:
            session_stats["max_queue"] = len(order_queue)

        if not order_queue:
            await asyncio.sleep(1)
            continue

        current_time = time.time()

        # Run all three schedulers on identical queue snapshot
        # Wait time = real timestamp delta — no multipliers
        fcfs_order     = fcfs(order_queue)[0].copy()
        priority_order = priority(order_queue)[0].copy()

        # Starvation demo: use pure priority (no aging) when mode = priority_only
        if runtime_flags["mode"] == "priority_only":
            hybrid_order = priority(order_queue)[0].copy()
        else:
            hybrid_order = hybrid(order_queue)[0].copy()

        fcfs_order["wait_time"]     = round(current_time - fcfs_order["arrival_time"],     4)
        priority_order["wait_time"] = round(current_time - priority_order["arrival_time"], 4)
        hybrid_order["wait_time"]   = round(current_time - hybrid_order["arrival_time"],   4)

        # Record for /stats endpoint
        session_stats["fcfs_waits"].append(fcfs_order["wait_time"])
        session_stats["priority_waits"].append(priority_order["wait_time"])
        session_stats["hybrid_waits"].append(hybrid_order["wait_time"])

        # Bound list size to last 1000 ticks
        for key in ("fcfs_waits", "priority_waits", "hybrid_waits"):
            if len(session_stats[key]) > 1000:
                session_stats[key] = session_stats[key][-1000:]

        # Order book — include user_type so frontend can show breakdown
        recent_orders = order_queue[-12:]

        await ws.send_json({
            "price":        round(price, 2),
            "fcfs":         fcfs_order,
            "priority":     priority_order,
            "hybrid":       hybrid_order,
            "queue_length": len(order_queue),
            "buy_orders":   [o for o in recent_orders if o["type"] == "BUY"],
            "sell_orders":  [o for o in recent_orders if o["type"] == "SELL"],
            "crash":        is_crash,
            "mode":         runtime_flags["mode"],
            "tick_stats": {
                "orders_arrived":   num_orders,
                "orders_processed": processed_count,
                "overflow":         max(0, num_orders - processed_count),
            },
        })

        await asyncio.sleep(1)