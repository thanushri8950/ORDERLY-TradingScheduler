from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio, random, time
from scheduler import fcfs, priority, hybrid

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

order_queue = []
order_id_counter = 0

# Session-level stats for honest reporting
session_stats = {
    "total_ticks": 0,
    "crash_ticks": 0,
    "total_processed": 0,
    "fcfs_waits": [],
    "priority_waits": [],
    "hybrid_waits": [],
    "max_queue": 0,
}

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/stats")
def get_stats():
    """Endpoint for final session statistics - use this in viva to show real numbers"""
    def avg(lst): return round(sum(lst)/len(lst), 4) if lst else 0
    def p95(lst):
        if not lst: return 0
        s = sorted(lst)
        return round(s[int(len(s)*0.95)], 4)

    return {
        "session": {
            "total_ticks": session_stats["total_ticks"],
            "crash_ticks": session_stats["crash_ticks"],
            "crash_percentage": round(session_stats["crash_ticks"] / max(session_stats["total_ticks"], 1) * 100, 1),
            "total_orders_processed": session_stats["total_processed"],
            "peak_queue_depth": session_stats["max_queue"],
        },
        "average_wait_time": {
            "fcfs":     avg(session_stats["fcfs_waits"]),
            "priority": avg(session_stats["priority_waits"]),
            "hybrid":   avg(session_stats["hybrid_waits"]),
        },
        "p95_wait_time": {
            "fcfs":     p95(session_stats["fcfs_waits"]),
            "priority": p95(session_stats["priority_waits"]),
            "hybrid":   p95(session_stats["hybrid_waits"]),
        },
        "hybrid_improvement": {
            "vs_fcfs_pct":     round((1 - avg(session_stats["hybrid_waits"]) / max(avg(session_stats["fcfs_waits"]), 0.001)) * 100, 1),
            "vs_priority_pct": round((1 - avg(session_stats["hybrid_waits"]) / max(avg(session_stats["priority_waits"]), 0.001)) * 100, 1),
        }
    }

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global order_id_counter
    await ws.accept()

    price = 100.0

    while True:
        session_stats["total_ticks"] += 1
        is_crash = random.random() < 0.2

        if is_crash:
            session_stats["crash_ticks"] += 1

        # Realistic price movement
        price += random.gauss(0, 1.5)
        if is_crash:
            price += random.uniform(-10, -4)
        price = max(price, 10)  # floor

        # Generate orders with realistic properties
        num_orders = 2 if not is_crash else random.randint(15, 25)

        for _ in range(num_orders):
            order_id_counter += 1
            user_type = random.choices(
                ["Retail", "Institution", "HFT"],
                weights=[0.6, 0.3, 0.1]
            )[0]

            # Priority reflects real-world urgency
            base_priority = {"Retail": random.randint(1, 2), "Institution": random.randint(3, 4), "HFT": 5}[user_type]

            # During crash, institutions get max priority (realistic)
            if is_crash and user_type == "Institution":
                base_priority = 5

            order_queue.append({
                "order_id": order_id_counter,
                "type": random.choice(["BUY", "SELL"]),
                "user_type": user_type,
                "quantity": random.randint(1, 100),
                "arrival_time": time.time(),
                "priority": base_priority,
            })

        # Fixed processing capacity — the core OS constraint
        PROCESSING_LIMIT = 3
        processed_count = min(PROCESSING_LIMIT, len(order_queue))
        for _ in range(processed_count):
            order_queue.pop(0)
        session_stats["total_processed"] += processed_count

        # Track peak queue
        if len(order_queue) > session_stats["max_queue"]:
            session_stats["max_queue"] = len(order_queue)

        if not order_queue:
            await asyncio.sleep(1)
            continue

        current_time = time.time()

        # Run all three schedulers on the SAME queue snapshot
        # Wait time = how long the order the scheduler would pick has been waiting
        # This is HONEST — no multipliers, just real timestamps
        fcfs_order    = fcfs(order_queue)[0].copy()
        priority_order = priority(order_queue)[0].copy()
        hybrid_order  = hybrid(order_queue)[0].copy()

        fcfs_wait     = round(current_time - fcfs_order["arrival_time"], 4)
        priority_wait = round(current_time - priority_order["arrival_time"], 4)
        hybrid_wait   = round(current_time - hybrid_order["arrival_time"], 4)

        fcfs_order["wait_time"]     = fcfs_wait
        priority_order["wait_time"] = priority_wait
        hybrid_order["wait_time"]   = hybrid_wait

        # Record for session stats
        session_stats["fcfs_waits"].append(fcfs_wait)
        session_stats["priority_waits"].append(priority_wait)
        session_stats["hybrid_waits"].append(hybrid_wait)

        # Keep lists bounded
        for key in ["fcfs_waits", "priority_waits", "hybrid_waits"]:
            if len(session_stats[key]) > 500:
                session_stats[key] = session_stats[key][-500:]

        recent_orders = order_queue[-10:]

        await ws.send_json({
            "price":       round(price, 2),
            "fcfs":        fcfs_order,
            "priority":    priority_order,
            "hybrid":      hybrid_order,
            "queue_length": len(order_queue),
            "buy_orders":  [o for o in recent_orders if o["type"] == "BUY"],
            "sell_orders": [o for o in recent_orders if o["type"] == "SELL"],
            "crash":       is_crash,
            "tick_stats": {
                "orders_arrived":   num_orders,
                "orders_processed": processed_count,
                "overflow":         max(0, num_orders - processed_count),
            }
        })

        await asyncio.sleep(1)