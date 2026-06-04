"""
scheduler.py — Three scheduling algorithms for ORDERLY

OS Concept mapping:
  fcfs     → Non-preemptive FCFS: arrival order, no priority
  priority → Preemptive priority: highest priority first, starvation possible
  hybrid   → Multi-Level Feedback Queue (MLFQ): priority + aging
              Aging: orders waiting > 2s get priority boosted by 1
              This prevents starvation while keeping urgency ordering
"""

import time


def fcfs(queue: list) -> list:
    """
    First-Come, First-Served.
    Returns queue sorted by arrival_time ascending.
    OS analog: Non-preemptive scheduling, ready queue in FIFO order.
    Weakness: Under burst load, high-priority orders wait behind low-priority ones.
    """
    return sorted(queue, key=lambda o: o["arrival_time"])


def priority(queue: list) -> list:
    """
    Priority-Based Scheduling.
    Returns queue sorted by priority descending (higher = more urgent).
    Ties broken by arrival_time (fairer within same priority level).
    OS analog: Preemptive priority scheduling.
    Weakness: Low-priority orders can starve if high-priority orders keep arriving.
    """
    return sorted(queue, key=lambda o: (-o["priority"], o["arrival_time"]))


def hybrid(queue: list) -> list:
    """
    Hybrid: Priority + Aging.
    OS analog: Multi-Level Feedback Queue (MLFQ).

    Aging rule: For each second an order has waited beyond 2s,
    its effective priority is boosted by 0.5 (capped at 5).
    This ensures no order waits indefinitely while still serving
    urgent orders first under normal conditions.

    This is the key OS concept: aging prevents starvation,
    which pure priority scheduling cannot guarantee.
    """
    now = time.time()
    AGING_THRESHOLD = 2.0   # seconds before aging kicks in
    AGING_RATE = 0.5         # priority boost per second of excess wait

    def effective_priority(order):
        wait = now - order["arrival_time"]
        excess_wait = max(0, wait - AGING_THRESHOLD)
        boost = min(excess_wait * AGING_RATE, 5 - order["priority"])
        return order["priority"] + boost

    return sorted(queue, key=lambda o: (-effective_priority(o), o["arrival_time"]))