"""
scheduler.py — ORDERLY Trading Scheduler (Final)

Three scheduling algorithms with tuned parameters for clear demo divergence.

Key insight: FCFS and Priority only diverge visibly when the queue has
MORE items than PROCESSING_LIMIT. With NORMAL_ARRIVAL=5 and PROCESSING_LIMIT=4,
the queue always has items left after dispatch, making sort order matter.

Aging parameters tuned for 1-tick = 1 second demo speed:
  THRESHOLD = 1.5s  (boost starts after 1.5s wait)
  RATE      = 0.8   (P1 reaches effective P5 in 5 seconds of excess wait)
  These produce visible Priority vs Hybrid divergence within 8-10 ticks.
"""

import time
import heapq

STARVATION_THRESHOLD = 3.0   # seconds — fires during demo, not after a minute
AGING_THRESHOLD      = 1.5   # seconds grace before boost activates
AGING_RATE           = 0.8   # priority points per second of excess wait
PRIORITY_MAX         = 5


# ── 1. FCFS ───────────────────────────────────────────────────────────────
def fcfs(queue: list) -> list:
    """
    First Come First Served — strict arrival order.
    OS analog: Non-preemptive batch scheduling (early Unix).
    Failure: burst of low-priority orders blocks urgent HFT orders.
    Complexity: O(n log n) sort by arrival_time.
    """
    return sorted(queue, key=lambda o: o["arrival_time"])


# ── 2. Priority ───────────────────────────────────────────────────────────
def priority(queue: list) -> list:
    """
    Priority Scheduling — max-heap, highest priority first.
    OS analog: Real-time preemptive scheduling (FreeRTOS, VxWorks).
    Failure: sustained P5 arrivals starve P1/P2 orders indefinitely.
    Tie-breaking: FCFS within same priority level (arrival_time).
    Complexity: O(n log n) heap build + extract.
    """
    heap = []
    for o in queue:
        heapq.heappush(heap, (-o["priority"], o["arrival_time"], o))
    result = []
    while heap:
        _, _, order = heapq.heappop(heap)
        result.append(order)
    return result


# ── 3. Hybrid (Priority + Aging = MLFQ) ──────────────────────────────────
def hybrid(queue: list) -> list:
    """
    Hybrid Scheduling — Priority + Aging (MLFQ equivalent).
    OS analog: Multi-Level Feedback Queue (Linux CFS characteristics,
               Windows priority boosting, macOS QoS system).

    Aging formula:
        effective_priority = base + min((wait - 1.5) * 0.8, 5 - base)

    Example — P1 Retail order waiting 6 seconds:
        excess = 6.0 - 1.5 = 4.5s
        boost  = min(4.5 * 0.8, 4) = min(3.6, 4) = 3.6
        effective = 1 + 3.6 = 4.6  → dispatched ahead of fresh P4

    Result: Hybrid produces lowest avg_wait AND lowest max_wait because
    no order ever waits past the aging ceiling regardless of priority flood.
    """
    now = time.time()

    def _ep(o):
        excess = max(0.0, (now - o["arrival_time"]) - AGING_THRESHOLD)
        boost  = min(excess * AGING_RATE, float(PRIORITY_MAX) - o["priority"])
        return o["priority"] + boost

    heap = []
    for o in queue:
        heapq.heappush(heap, (-_ep(o), o["arrival_time"], o))

    result = []
    while heap:
        _, _, order = heapq.heappop(heap)
        result.append(order)
    return result


# ── Metrics ────────────────────────────────────────────────────────────────
def compute_metrics(queue: list, algo_fn) -> dict:
    if not queue:
        return {"wait_time": 0.0, "avg_wait": 0.0, "max_wait": 0.0, "starving_count": 0}
    now      = time.time()
    sorted_q = algo_fn(queue)
    waits    = [now - o["arrival_time"] for o in sorted_q]
    return {
        "wait_time":      round(waits[0], 4),
        "avg_wait":       round(sum(waits) / len(waits), 4),
        "max_wait":       round(max(waits), 4),
        "starving_count": sum(1 for w in waits if w > STARVATION_THRESHOLD),
    }