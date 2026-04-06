import random
import pandas as pd


# ------------------ ORDER GENERATOR ------------------
def generate_orders(n=10, burst=False):
    orders = []

    for i in range(n):
        if burst:
            arrival_time = random.randint(0, 5)
        else:
            arrival_time = i

        order = {
            "order_id": i,
            "arrival_time": arrival_time,
            "burst_time": random.randint(1, 5),
            "priority": random.randint(1, 5),
            "type": random.choice(["BUY", "SELL"]),
            "user_type": random.choice(["RETAIL", "HFT"])
        }

        orders.append(order)

    df = pd.DataFrame(orders)
    return df.sort_values(by="arrival_time").reset_index(drop=True)


# ------------------ FCFS ------------------
def fcfs_scheduler(df):
    df = df.sort_values(by="arrival_time").copy()

    current_time = 0
    result = []

    for _, row in df.iterrows():
        start_time = max(current_time, row["arrival_time"])
        completion_time = start_time + row["burst_time"]

        result.append({
            **row,
            "start_time": start_time,
            "completion_time": completion_time,
            "waiting_time": start_time - row["arrival_time"],
            "turnaround_time": completion_time - row["arrival_time"]
        })

        current_time = completion_time

    return pd.DataFrame(result)


# ------------------ PRIORITY ------------------
def priority_scheduler(df):
    df = df.copy()
    completed = []
    current_time = 0

    while not df.empty:
        available = df[df["arrival_time"] <= current_time]

        if available.empty:
            current_time += 1
            continue

        idx = available["priority"].idxmin()
        job = df.loc[idx]

        start_time = max(current_time, job["arrival_time"])
        completion_time = start_time + job["burst_time"]

        completed.append({
            **job,
            "start_time": start_time,
            "completion_time": completion_time,
            "waiting_time": start_time - job["arrival_time"],
            "turnaround_time": completion_time - job["arrival_time"]
        })

        current_time = completion_time
        df = df.drop(idx)

    return pd.DataFrame(completed)


# ------------------ MAIN ------------------
if __name__ == "__main__":
    df = generate_orders(50, burst=True)

    print("\nGenerated Orders:\n")
    print(df)

    fcfs_result = fcfs_scheduler(df)
    print("\nFCFS Scheduling Result:\n")
    print(fcfs_result)

    priority_result = priority_scheduler(df)
    print("\nPriority Scheduling Result:\n")
    print(priority_result)

    print("\nAverage Waiting Time (FCFS):", fcfs_result["waiting_time"].mean())
    print("Average Waiting Time (Priority):", priority_result["waiting_time"].mean())

    print("\nMax Waiting Time (FCFS):", fcfs_result["waiting_time"].max())
    print("Max Waiting Time (Priority):", priority_result["waiting_time"].max())