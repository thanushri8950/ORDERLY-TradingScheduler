from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random
import time

from scheduler import fcfs, priority, hybrid

app = FastAPI()

# CORS (important for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# global queue
order_queue = []

@app.get("/")
def root():
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    print("Client trying to connect...")
    await ws.accept()
    print("WebSocket CONNECTED ✅")

    price = 100

    while True:
        # 🔥 CRASH MODE
        is_crash = random.random() < 0.2

        # price simulation
        price += random.uniform(-2, 2)
        if is_crash:
            price += random.uniform(-8, -3)

        # 🔥 number of incoming orders
        num_orders = 2 if not is_crash else 20

        # generate orders
        for _ in range(num_orders):
            order = {
                "order_id": random.randint(1, 1000),
                "type": random.choice(["BUY", "SELL"]),
                "user_type": random.choice(["Retail", "Institution"]),
                "quantity": random.randint(1, 50),
                "arrival_time": time.time(),
                "priority": random.randint(1, 5)
            }

            # optional smart logic
            if is_crash and order["user_type"] == "Institution":
                order["priority"] = 5

            order_queue.append(order)

        # 🔥 PROCESSING LIMIT (CORE LOGIC)
        PROCESSING_LIMIT = 3
        for _ in range(min(PROCESSING_LIMIT, len(order_queue))):
            order_queue.pop(0)

        # safety check
        if not order_queue:
            await asyncio.sleep(1)
            continue

        # schedulers
        fcfs_order = fcfs(order_queue)[0].copy()
        priority_order = priority(order_queue)[0].copy()
        hybrid_order = hybrid(order_queue)[0].copy()

        # wait times
        current_time = time.time()

        fcfs_order["wait_time"] = round(current_time - fcfs_order["arrival_time"], 2)
        priority_order["wait_time"] = round(current_time - priority_order["arrival_time"], 2)
        hybrid_order["wait_time"] = round(current_time - hybrid_order["arrival_time"], 2)

        # last 10 orders
        recent_orders = order_queue[-10:]
        buy_orders = [o for o in recent_orders if o["type"] == "BUY"]
        sell_orders = [o for o in recent_orders if o["type"] == "SELL"]

        # response
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

        print("Sending:", data)

        await ws.send_json(data)
        await asyncio.sleep(1)