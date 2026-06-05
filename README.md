# ORDERLY — Trading Scheduler
### OS Scheduling Algorithms Applied to Financial Market Simulation

---

## Problem Statement

Modern stock exchanges experience sudden bursts of trading orders during market volatility — news releases, algorithmic spikes, price cascades. During these events:

- Large volumes of orders arrive simultaneously, exceeding processing capacity
- Traditional FCFS scheduling processes orders in arrival order, ignoring urgency
- High-priority institutional orders get delayed behind low-priority retail orders
- Queue overflow leads to mounting wait times and degraded execution reliability

**This project demonstrates — with real measured timestamps — that a Hybrid scheduling algorithm (Priority + Aging) outperforms both FCFS and pure Priority scheduling under these conditions.**

---

## OS Concept Mapping

| OS Concept | Trading Equivalent | Where Visible in UI |
|---|---|---|
| CPU Ready Queue | Order Queue | Queue Depth panel |
| Process Arrival Rate | Orders/tick | 2 normal, 15–25 during crash |
| CPU Processing Capacity | 3 orders/tick cap | Fixed throughput constraint |
| FCFS Scheduling | Arrival-order dispatch | FCFS line — spikes during crash |
| Priority Scheduling | Institutional > Retail | Priority line — starvation risk |
| MLFQ (Multi-Level Feedback Queue) | Hybrid scheduler | Hybrid line — lowest wait, no starvation |
| Process Starvation | P1 order never executing | Starvation Demo toggle in Performance tab |
| Aging / Priority Boost | Hybrid: +0.5 priority/sec after 2s wait | Prevents P1 starvation in Hybrid |
| Burst Process Arrival | Market crash simulation | 20% tick probability, crash banner |
| System Thrash / Overload | Queue depth > 30 | Red stress threshold on queue chart |

---

## Scheduling Algorithms

### FCFS — First Come First Served
```
sort(queue, key=arrival_time)
```
**OS analog:** Non-preemptive scheduling. No awareness of urgency. Under burst load, a flood of P1 Retail orders delays P5 HFT orders waiting behind them.

### Priority — Priority-Based
```
sort(queue, key=(-priority, arrival_time))
```
**OS analog:** Preemptive priority scheduling. Higher priority always wins. **Problem:** P1/P2 Retail orders can wait indefinitely if P5 orders keep arriving — **starvation**.

### Hybrid — Priority + Aging (MLFQ equivalent)
```
effective_priority = priority + min((wait - 2s) * 0.5, 5 - priority)
sort(queue, key=(-effective_priority, arrival_time))
```
**OS analog:** Multi-Level Feedback Queue. Aging kicks in after 2 seconds — every order eventually gets promoted. **No starvation. Lowest average wait time.**

---

## Architecture

```
Backend  FastAPI + WebSocket (main.py)
          ├── /ws          — live data stream (1 tick/sec)
          ├── /stats       — session metrics: avg wait, P95, improvement %
          ├── /benchmark/start — forces 35 ticks of crash mode
          └── /mode/{mode} — toggle normal / priority_only (starvation demo)

Frontend  React + Recharts (App.jsx)
          ├── Markets tab       — price chart, order book, KPIs
          ├── Schedulers tab    — three-way comparison, bar chart
          ├── Queue Analysis    — depth chart, OS mapping explanation
          ├── OS Concepts       — full problem→solution table
          └── Performance tab   — benchmark button, starvation demo,
                                  user type breakdown, session stats
```

---

## Key Results (fill in after running benchmark)

| Metric | FCFS | Priority | Hybrid |
|---|---|---|---|
| Average wait time | ___s | ___s | ___s |
| P95 wait time | ___s | ___s | ___s |
| Hybrid improvement | — | — | baseline |

*Run the benchmark button in the Performance tab, then hit `localhost:8000/stats` to fill these in.*

---

## What Makes This Unique

**1. Domain-grounded OS demonstration.**
Most scheduling demos use abstract job arrays. Every OS concept here maps to a real financial domain component — the analogy is structurally accurate, not decorative.

**2. Controllable crash simulation.**
Real trading systems cannot reproduce a market crash on demand. This system injects burst load deterministically, making the scheduling difference reliably observable during a live demo.

**3. Three-way simultaneous comparison.**
All three schedulers run on the identical queue snapshot every tick. Wait times are real timestamp deltas — no multipliers, no fabricated data.

**4. Starvation proof by demonstration.**
The starvation demo toggle disables aging and shows P1 orders never executing. Re-enabling Hybrid shows them eventually dispatch. This proves *why* MLFQ exists in OS design.

---

## Running the Project

```bash
# Backend
cd backend
uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
```

Navigate to `localhost:5173`. Go to **Performance** tab → click **Run Benchmark** for proof numbers.

