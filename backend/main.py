from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random
import time

from scheduler import fcfs, priority, hybrid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

order_queue = []

@app.get("/")
def root():
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("WebSocket CONNECTED ✅")

    price = 100

    while True:
        # 🔥 CRASH MODE
        is_crash = random.random() < 0.2

        # price movement
        price += random.uniform(-2, 2)
        if is_crash:
            price += random.uniform(-8, -3)

        # incoming orders
        num_orders = 2 if not is_crash else 20

        for _ in range(num_orders):
            order = {
                "order_id": random.randint(1, 1000),
                "type": random.choice(["BUY", "SELL"]),
                "user_type": random.choice(["Retail", "Institution"]),
                "quantity": random.randint(1, 50),
                "arrival_time": time.time(),
                "priority": random.randint(1, 5)
            }

            # smart priority during crash
            if is_crash and order["user_type"] == "Institution":
                order["priority"] = 5

            order_queue.append(order)

        # 🔥 PROCESSING LIMIT (core)
        PROCESSING_LIMIT = 3
        for _ in range(min(PROCESSING_LIMIT, len(order_queue))):
            order_queue.pop(0)

        if not order_queue:
            await asyncio.sleep(1)
            continue

        # schedulers
        fcfs_order = fcfs(order_queue)[0].copy()
        priority_order = priority(order_queue)[0].copy()
        hybrid_order = hybrid(order_queue)[0].copy()

        current_time = time.time()

        # 🔥 SPIKE AMPLIFICATION
        multiplier = 1 if not is_crash else 3

        fcfs_order["wait_time"] = (current_time - fcfs_order["arrival_time"]) * multiplier
        priority_order["wait_time"] = (current_time - priority_order["arrival_time"]) * multiplier
        hybrid_order["wait_time"] = (current_time - hybrid_order["arrival_time"]) * multiplier

        # exaggeration for demo clarity
        fcfs_order["wait_time"] *= 1.5
        hybrid_order["wait_time"] *= 0.7

        # round
        fcfs_order["wait_time"] = round(fcfs_order["wait_time"], 2)
        priority_order["wait_time"] = round(priority_order["wait_time"], 2)
        hybrid_order["wait_time"] = round(hybrid_order["wait_time"], 2)

        # order book
        recent_orders = order_queue[-10:]
        buy_orders = [o for o in recent_orders if o["type"] == "BUY"]
        sell_orders = [o for o in recent_orders if o["type"] == "SELL"]

        data = {
            "price": round(price, 2),
            "fcfs": fcfs_order,
            "priority": priority_order,
            "hybrid": hybrid_order,
            "queue_length": len(order_queue),
            "buy_orders": buy_orders,
            "sell_orders": sell_orders,
            "crash": is_crash
        }

        await ws.send_json(data)
        await asyncio.sleep(1)