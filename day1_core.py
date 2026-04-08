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


# ------------------ BURST DETECTOR ------------------
def detect_burst(df, window=3, threshold=10):
    burst_times = []

    max_time = df["arrival_time"].max()

    for t in range(max_time + 1):
        count = len(df[
            (df["arrival_time"] >= t) &
            (df["arrival_time"] < t + window)
        ])

        if count >= threshold:
            burst_times.append(t)

    return burst_times


# ------------------ PREDICTIVE ------------------
def predictive_scheduler(df, burst_points):
    df = df.copy().reset_index(drop=True)
    completed = []
    current_time = 0

    df["priority"] = df["priority"].astype(float)

    max_time_limit = 10000  # safety

    while not df.empty and current_time < max_time_limit:
        available = df[df["arrival_time"] <= current_time]

        if available.empty:
            current_time += 1
            continue

        is_burst = current_time in burst_points

        # 🔥 Adaptive Aging
        for i in available.index:
            wait_time = current_time - df.loc[i, "arrival_time"]

            if is_burst:
                df.loc[i, "priority"] -= 0.3 * wait_time
            else:
                df.loc[i, "priority"] -= 0.2 * wait_time

        # 🔥 Retail Boost
        for i in available.index:
            if df.loc[i, "user_type"] == "RETAIL":
                if is_burst:
                    df.loc[i, "priority"] -= 0.5
                else:
                    df.loc[i, "priority"] -= 1.0

        # 🔥 Short Job Boost
        for i in available.index:
            burst = df.loc[i, "burst_time"]

            if is_burst:
                df.loc[i, "priority"] -= (1 / burst) * 3
            else:
                df.loc[i, "priority"] -= (1 / burst) * 2

        # 🔥 Select best job
        idx = df.loc[available.index]["priority"].idxmin()
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


# ------------------ MASTER FUNCTION (IMPORTANT) ------------------
def run_full_simulation(n=50):
    df = generate_orders(n, burst=True)

    fcfs = fcfs_scheduler(df)
    priority = priority_scheduler(df)

    burst = detect_burst(df)
    predictive = predictive_scheduler(df, burst)

    return {
        "orders": df.to_dict(orient="records"),
        "fcfs": fcfs.to_dict(orient="records"),
        "priority": priority.to_dict(orient="records"),
        "predictive": predictive.to_dict(orient="records"),
        "metrics": {
            "fcfs_avg_wait": float(fcfs["waiting_time"].mean()),
            "priority_avg_wait": float(priority["waiting_time"].mean()),
            "predictive_avg_wait": float(predictive["waiting_time"].mean()),
            "fcfs_max_wait": float(fcfs["waiting_time"].max()),
            "predictive_max_wait": float(predictive["waiting_time"].max())
        },
        "burst": burst
    }
