from fastapi import FastAPI, WebSocket
import asyncio
import random
import time

from scheduler import fcfs, priority, hybrid

app = FastAPI()

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
        # simulate price change
        price += random.uniform(-1, 1)

        # create order
        order = {
            "order_id": random.randint(1, 1000),
            "type": random.choice(["BUY", "SELL"]),
            "user_type": random.choice(["Retail", "Institution"]),
            "quantity": random.randint(1, 50),
            "arrival_time": time.time(),
            "priority": random.randint(1, 5)
        }

        # add to queue
        order_queue.append(order)

        # limit queue size
        if len(order_queue) > 50:
            order_queue.pop(0)

        # safety check
        if not order_queue:
            continue

        # apply schedulers
        fcfs_order = fcfs(order_queue)[0].copy()
        priority_order = priority(order_queue)[0].copy()
        hybrid_order = hybrid(order_queue)[0].copy()

        # calculate wait times
        current_time = time.time()

        fcfs_order["wait_time"] = round(current_time - fcfs_order["arrival_time"], 2)
        priority_order["wait_time"] = round(current_time - priority_order["arrival_time"], 2)
        hybrid_order["wait_time"] = round(current_time - hybrid_order["arrival_time"], 2)

        # get last 10 orders
        recent_orders = order_queue[-10:]

        # split into buy/sell
        buy_orders = [o for o in recent_orders if o["type"] == "BUY"]
        sell_orders = [o for o in recent_orders if o["type"] == "SELL"]

        # response data
        data = {
            "price": round(price, 2),
            "fcfs": fcfs_order,
            "priority": priority_order,
            "hybrid": hybrid_order,
            "queue_length": len(order_queue),
            "buy_orders": buy_orders,
            "sell_orders": sell_orders
        }

        print("Sending:", data)

        await ws.send_json(data)
        await asyncio.sleep(1)