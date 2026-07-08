"""
scheduler.py — Scheduling algorithms for ORDERLY Trading Scheduler

  1. FCFS     — First Come First Served (non-preemptive, FIFO)
  2. Priority — Priority-based scheduling (max-heap)
  3. Hybrid   — Priority + Aging (MLFQ equivalent)

Aging tuning (FAILPROOF DIVERGENCE):
  THRESHOLD = 0.5s, RATE = 1.0 priority/sec after excess wait.
  Combined with PROCESSING_LIMIT < average arrival capacity headroom
  in main.py, queues maintain a small persistent backlog so wait
  times regularly exceed 0.5s — aging is ALWAYS active, guaranteeing
  Hybrid's ordering visibly diverges from pure Priority every tick,
  not just during crash bursts.
"""

import time
import heapq


# ── 1. FCFS ───────────────────────────────────────────────────────────────
def fcfs(queue: list) -> list:
    """Non-preemptive FIFO — sorted by arrival_time only."""
    return sorted(queue, key=lambda o: o["arrival_time"])


# ── 2. Priority ───────────────────────────────────────────────────────────
def priority(queue: list) -> list:
    """
    Pure priority scheduling — max-heap on priority field.
    No aging. Higher priority always wins, regardless of wait time.
    """
    heap = []
    for o in queue:
        heapq.heappush(heap, (-o["priority"], o["arrival_time"], o["order_id"], o))
    result = []
    while heap:
        _, _, _, order = heapq.heappop(heap)
        result.append(order)
    return result


# ── 3. Hybrid (Priority + Aging = MLFQ) ──────────────────────────────────
THRESHOLD = 0.5   # seconds — grace period before aging activates
RATE      = 1.0   # priority points gained per second of excess wait

def hybrid(queue: list) -> list:
    """
    Hybrid Scheduling — Priority + Aging.

    effective_priority = base_priority + boost
    boost = min((wait_time - THRESHOLD) * RATE, 5 - base_priority)

    THRESHOLD=0.5s, RATE=1.0 — aging activates almost immediately,
    so under any sustained backlog Hybrid's ordering visibly diverges
    from pure Priority every tick. A P1 order waiting 4.5s gets:
        boost = min((4.5-0.5)*1.0, 4) = 4 -> effective_priority = 5
    """
    now = time.time()

    def effective_priority(o):
        wait   = now - o["arrival_time"]
        excess = max(0.0, wait - THRESHOLD)
        boost  = min(excess * RATE, 5.0 - o["priority"])
        return o["priority"] + boost

    heap = []
    for o in queue:
        ep = effective_priority(o)
        heapq.heappush(heap, (-ep, o["arrival_time"], o["order_id"], o))

    result = []
    while heap:
        _, _, _, order = heapq.heappop(heap)
        result.append(order)
    return result


# ── Metrics ────────────────────────────────────────────────────────────────
def compute_metrics(queue: list, algo_fn) -> dict:
    if not queue:
        return {"wait_time": 0, "avg_wait": 0, "max_wait": 0, "starving_count": 0}
    now = time.time()
    sorted_q = algo_fn(queue)
    waits = [now - o["arrival_time"] for o in sorted_q]
    return {
        "wait_time":      round(waits[0], 4),
        "avg_wait":       round(sum(waits) / len(waits), 4),
        "max_wait":       round(max(waits), 4),
        "starving_count": sum(1 for w in waits if w > 5.0),
    }
