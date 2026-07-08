import { useEffect, useState, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";

/* ────────────────────────────────────────────────────────────────────────────
   Design system — exchange operations console: calm base, strong status colors,
   compact information density, and charts tuned for repeated monitoring.
──────────────────────────────────────────────────────────────────────────── */
const C = {
  bg:       "#f6f8fb",
  panel:    "#ffffff",
  surface:  "#f9fafb",
  subtle:   "#eef2f7",
  border:   "#d9e1ec",
  borderMd: "#b9c5d6",
  text:     "#111827",
  mid:      "#374151",
  muted:    "#6b7280",
  red:      "#c2410c",   redBg:  "#fff7ed", redMid: "#fed7aa",
  green:    "#047857",   greenBg:"#ecfdf5", greenMd:"#a7f3d0",
  amber:    "#b7791f",   amberBg:"#fffbeb",
  purple:   "#6d28d9",   purpleBg:"#f5f3ff",
  blue:     "#1d4ed8",   blueBg: "#eff6ff",
  black:    "#111827",
  nav:      "#101820",
  ticker:   "#0b1118",
  mono:     "'Courier New', Courier, monospace",
  serif:    "'Helvetica Neue', Helvetica, Arial, sans-serif",
  sans:     "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

/* ── micro components ──────────────────────────────────────────────────────── */
const Tag = ({ label, color, bg }) => (
  <span style={{
    fontFamily: C.sans, fontSize: 9, fontWeight: "bold",
    padding: "2px 7px", letterSpacing: "0.07em", textTransform: "uppercase",
    color: color, background: bg || color + "18",
    border: `1px solid ${color}44`, whiteSpace: "nowrap",
  }}>{label}</span>
);

const PanelHead = ({ title, sub, right }) => (
  <div style={{
    padding: "11px 16px",
    borderBottom: `1px solid ${C.border}`,
    background: C.surface,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontFamily: C.serif, fontSize: 15, fontWeight: "bold", color: C.text }}>{title}</span>
      {sub && <span style={{ fontFamily: C.sans, fontSize: 10, color: C.muted }}>{sub}</span>}
    </div>
    {right}
  </div>
);

const Panel = ({ title, sub, accent = C.black, right, children, noPad, style = {} }) => (
  <div style={{
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: C.border,
    borderTopWidth: 3,
    borderTopColor: accent,
    background: C.panel,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
    ...style,
  }}>
    <PanelHead title={title} sub={sub} right={right} />
    <div style={noPad ? {} : { padding: "16px" }}>{children}</div>
  </div>
);

const KPICard = ({ label, value, sub, color = C.text, bg = C.bg, accent }) => (
  <div style={{
    background: bg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: C.border,
    borderTopWidth: 3,
    borderTopColor: accent || color,
    boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
    padding: "14px 16px",
  }}>
    <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: "bold", color, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, marginTop: 5 }}>{sub}</div>}
  </div>
);

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.borderMd}`, padding: "8px 12px", boxShadow: "0 2px 10px rgba(0,0,0,.08)" }}>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: C.mono, fontSize: 10, color: p.color, marginBottom: 2 }}>
          {String(p.name).toUpperCase()}: <span style={{ color: C.text }}>{Number(p.value).toFixed(3)}s</span>
        </div>
      ))}
    </div>
  );
};
const ax = { fontFamily: C.mono, fontSize: 9, fill: C.muted };
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const blend = (prev, next, alpha = 0.24) => prev == null ? next : prev * (1 - alpha) + next * alpha;

/* ── Scheduler Lane ─────────────────────────────────────────────────────────
   Shows the sorted queue as this algorithm sees it.
   Row 1 = next order to dispatch. Clearly labeled with OS analog.
──────────────────────────────────────────────────────────────────────────── */
const Lane = ({ name, osAnalog, color, metrics, queueRows, isBest, starving, selected, onSelect }) => (
  <div onClick={onSelect} style={{
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: selected ? color : C.border,
    borderTopWidth: 3,
    borderTopColor: color,
    boxShadow: selected ? `0 0 0 2px ${color}55` : "none",
    background: isBest ? C.greenBg : C.panel,
    display: "flex", flexDirection: "column", cursor: "pointer",
  }}>
    {/* Header */}
    <div style={{
      padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
      background: isBest ? C.greenBg : C.surface,
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    }}>
      <div>
        <div style={{ fontFamily: C.sans, fontSize: 14, fontWeight: "bold", color, marginBottom: 2 }}>
          {name} {selected && <Tag label="SELECTED" color={color} />}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: 10, color: C.muted }}>{osAnalog}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: "bold", color: isBest ? C.green : C.mid, lineHeight: 1 }}>
          {metrics?.wait_time?.toFixed(3) ?? "0.000"}s
        </div>
        <div style={{ marginTop: 3 }}>
          {isBest ? <Tag label="BEST ★" color={C.green} /> : <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>wait time</span>}
        </div>
      </div>
    </div>

    {/* Sub-metrics row */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
      {[
        { l: "Avg Wait",  v: `${(metrics?.avg_wait ?? 0).toFixed(2)}s`,   c: C.mid },
        { l: "Max Wait",  v: `${(metrics?.max_wait ?? 0).toFixed(2)}s`,   c: metrics?.max_wait > 5 ? C.red : C.mid },
        { l: "P95 Wait",  v: `${(metrics?.p95_wait ?? 0).toFixed(2)}s`,   c: C.purple },
        { l: "Starving",  v: metrics?.starving_count ?? 0,                 c: (metrics?.starving_count ?? 0) > 0 ? C.red : C.green },
      ].map((m, i) => (
        <div key={i} style={{ padding: "8px 12px", borderRight: i < 3 ? `1px solid ${C.border}` : "none", background: C.surface }}>
          <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{m.l}</div>
          <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: "bold", color: m.c }}>{m.v}</div>
        </div>
      ))}
    </div>

    {/* Cumulative row */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${C.border}`, background: C.subtle }}>
      {[
        { l: "Queue Len",   v: metrics?.queue_length ?? 0, c: (metrics?.queue_length ?? 0) > 30 ? C.red : C.mid },
        { l: "Processed Σ", v: metrics?.cumulative_processed ?? 0, c: C.green },
        { l: "Rejected Σ",  v: metrics?.cumulative_rejected ?? 0, c: (metrics?.cumulative_rejected ?? 0) > 0 ? C.red : C.mid },
      ].map((m, i) => (
        <div key={i} style={{ padding: "6px 12px", borderRight: i < 2 ? `1px solid ${C.border}` : "none", textAlign: "center" }}>
          <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{m.l}</div>
          <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: "bold", color: m.c }}>{m.v}</div>
        </div>
      ))}
    </div>

    {/* Queue rows */}
    <div style={{ padding: "10px 12px" }}>
      <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        Queue sorted by {name}
      </div>
      {(queueRows || []).slice(0, 6).map((o, i) => (
        <div key={o.order_id} style={{
          display: "grid", gridTemplateColumns: "20px 52px 1fr 44px 64px",
          gap: 6, alignItems: "center",
          padding: "5px 8px", marginBottom: 3,
          background: i === 0 ? color + "12" : C.bg,
          border: `1px solid ${i === 0 ? color + "55" : C.border}`,
        }}>
          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>{i + 1}</span>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.text }}>#{o.order_id}</span>
          <div style={{ height: 4, background: C.subtle, borderRadius: 1 }}>
            <div style={{ width: `${Math.min(o.quantity / 2, 100)}%`, height: "100%", background: color, opacity: 0.4, borderRadius: 1 }} />
          </div>
          <Tag label={`P${o.priority}`} color={o.priority >= 4 ? C.red : o.priority >= 3 ? C.amber : C.muted} />
          {starving && o.priority <= 2 && i >= 3
            ? <Tag label="STARVING" color={C.red} />
            : <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.user_type}</span>}
        </div>
      ))}
    </div>
  </div>
);

/* ── main app ─────────────────────────────────────────────────────────────── */
export default function App() {
  const [price, setPrice]       = useState(22000);
  const [prevPrice, setPrev]    = useState(22000);
  const [queue, setQueue]       = useState(0);
  const [isCrash, setIsCrash]   = useState(false);
  const [connected, setConn]    = useState(false);
  const [tick, setTick]         = useState(0);
  const [realData, setRealData] = useState(false);
  const [priceSource, setPriceSrc] = useState("GBM simulation");

  const [metrics, setMetrics] = useState({ fcfs: {}, priority: {}, hybrid: {} });
  const [fcfsQ, setFcfsQ]     = useState([]);
  const [priQ, setPriQ]       = useState([]);
  const [hybQ, setHybQ]       = useState([]);

  const [history, setHistory]   = useState([]);
  const [priceHist, setPH]      = useState([]);

  // EMA stats for summary — 0.85 old + 0.15 new to stay responsive
  const [avg, setAvg] = useState({ fcfs: "0.000", priority: "0.000", hybrid: "0.000" });

  const [tickStats, setTickStats] = useState({ arrived: 0, processed: 0, rejected: 0, overflow: 0 });

  const [starving, setStarving]         = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResult, setBenchResult]   = useState(null);
  const [eventLog, setEventLog]         = useState([]);
  const [sessionTotals, setSessionTotals] = useState({ processed: 0, rejected: 0, crashes: 0 });
  const [best, setBest] = useState("hybrid");
  const [gantt, setGantt] = useState([]);
  const [systemLoad, setSystemLoad] = useState(0);
  const [systemLoadAvg, setSystemLoadAvg] = useState(0);
  const [autoCrash, setAutoCrash] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState("hybrid");
  const [loadHistory, setLoadHistory] = useState([]);
  const [connectedClients, setConnectedClients] = useState(0);
  const [tickInterval, setTickInterval] = useState(1.25);

  const tickRef = useRef(0);

  // Check backend for real data status
  useEffect(() => {
    fetch(`${API_BASE}/`)
      .then(r => r.json())
      .then(d => { setRealData(!!d.real_data_active); setPriceSrc(d.price_source || "GBM simulation"); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ws;
    let retryTimer;
    let stopped = false;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/ws`);
      ws.onopen = () => setConn(true);
      ws.onclose = () => {
        setConn(false);
        if (!stopped) retryTimer = window.setTimeout(connect, 1200);
      };
      ws.onerror = () => {
        setConn(false);
        ws.close();
      };

      ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      tickRef.current = d.server_tick ?? (tickRef.current + 1);
      const t = tickRef.current;
      setTick(t);

      setPrice(p => { setPrev(p); return d.price; });
      setIsCrash(!!d.crash);
      setQueue(d.queue_length ?? d.hybrid?.queue_length ?? 0);
      setMetrics({ fcfs: d.fcfs || {}, priority: d.priority || {}, hybrid: d.hybrid || {} });
      setFcfsQ(d.fcfs_queue || []);
      setPriQ(d.priority_queue || []);
      setHybQ(d.hybrid_queue || []);
      setTickStats(d.tick_stats || {});
      if (d.best) setBest(d.best);
      setGantt(d.gantt || []);
      setSystemLoad(d.system_load || 0);
      setSystemLoadAvg(d.system_load_avg || 0);
      setConnectedClients(d.connected_clients || 0);
      setTickInterval(d.tick_interval || 1.25);
      setLoadHistory(h => {
        const last = h[h.length - 1];
        return [...h.slice(-180), {
          t,
          load: blend(last?.load, d.system_load || 0, d.crash ? 0.38 : 0.18),
          raw_load: d.system_load || 0,
        }];
      });

      const fw = Number(d.fcfs?.wait_time     || 0);
      const pw = Number(d.priority?.wait_time || 0);
      const hw = Number(d.hybrid?.wait_time   || 0);

      setHistory(h => {
        const last = h[h.length - 1];
        const alpha = d.crash ? 0.42 : 0.20;
        const q = d.queue_length ?? d.hybrid?.queue_length ?? 0;
        return [...h.slice(-180), {
          t,
          fcfs: blend(last?.fcfs, fw, alpha),
          priority: blend(last?.priority, pw, alpha),
          hybrid: blend(last?.hybrid, hw, alpha),
          raw_fcfs: fw,
          raw_priority: pw,
          raw_hybrid: hw,
          queue: blend(last?.queue, q, d.crash ? 0.45 : 0.22),
          raw_queue: q,
        }];
      });
      setPH(h => {
        const last = h[h.length - 1];
        return [...h.slice(-180), {
          t,
          price: blend(last?.price, d.price, d.crash ? 0.34 : 0.16),
          raw_price: d.price,
        }];
      });

      // EMA only for summary KPIs
      setAvg(prev => ({
        fcfs:     (Number(prev.fcfs)     * 0.88 + fw * 0.12).toFixed(3),
        priority: (Number(prev.priority) * 0.88 + pw * 0.12).toFixed(3),
        hybrid:   (Number(prev.hybrid)   * 0.88 + hw * 0.12).toFixed(3),
      }));

      setSessionTotals(prev => ({
        processed: prev.processed + (d.tick_stats?.processed_hybrid || 0),
        rejected:  prev.rejected  + (d.tick_stats?.overflow || 0),
        crashes:   prev.crashes   + (d.crash ? 1 : 0),
      }));

      const ts = new Date().toLocaleTimeString("en-IN", { hour12: false });
      if (d.crash) {
        setEventLog(l => [{
          ts, type: "crash",
          msg: `BURST LOAD — arrived: ${d.tick_stats?.arrived}  processed (Hybrid): ${d.tick_stats?.processed_hybrid || 0}  overflow: ${d.tick_stats?.overflow || 0}  queue: ${d.queue_length ?? d.hybrid?.queue_length ?? 0}`,
        }, ...l.slice(0, 11)]);
      }
      };
    };

    connect();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  const triggerCrash = () => {
    fetch(`${API_BASE}/crash/trigger`).catch(() => {});
  };

  const toggleStarvation = () => {
    const next = !starving;
    setStarving(next);
    fetch(`${API_BASE}/mode/${next ? "priority_only" : "normal"}`).catch(() => {});
  };

  const runBenchmark = async () => {
    setBenchRunning(true);
    setBenchResult(null);
    try {
      await fetch(`${API_BASE}/benchmark/start`);
    } catch {
      setBenchResult({ error: "Backend unreachable at /benchmark/start" });
      setBenchRunning(false);
      return;
    }
    await new Promise(r => setTimeout(r, 36000));
    try {
      const res  = await fetch(`${API_BASE}/stats`);
      setBenchResult(await res.json());
    } catch {
      setBenchResult({ error: "Backend unreachable at /stats" });
    }
    setBenchRunning(false);
  };

  const priceUp   = price >= prevPrice;
  const priceDisp = price > 1000
    ? `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `₹${price.toFixed(2)}`;

  return (
    <>
      <style>{`
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:none} }
        * { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:${C.bg}; color:${C.text}; font-family:${C.sans}; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:${C.subtle}; }
        ::-webkit-scrollbar-thumb { background:${C.borderMd}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg }}>

        {/* ── LIVE TICKER BAR ─────────────────────────────────────── */}
        <div style={{ background: C.ticker, height: 34, display: "flex", alignItems: "center", overflowX: "auto" }}>
          <div style={{ padding: "0 18px", borderRight: "1px solid #1e1e1e", flexShrink: 0 }}>
            <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: "bold", color: "#f5a623", letterSpacing: "0.18em" }}>ORDERLY</span>
          </div>
          {[
            { l: realData ? "NIFTY50" : "SIM PRICE", v: priceDisp,                    c: priceUp ? "#22c55e" : C.red },
            { l: "QUEUE DEPTH",                       v: queue,                        c: queue > 30 ? C.red : "#22c55e" },
            { l: "HYBRID AVG",                        v: `${avg.hybrid}s`,             c: "#22c55e" },
            { l: "FCFS AVG",                          v: `${avg.fcfs}s`,               c: C.red },
            { l: "PRIORITY AVG",                      v: `${avg.priority}s`,           c: C.amber },
            { l: "PROCESSED",                         v: sessionTotals.processed,      c: "#aaa" },
            { l: "CRASHES",                           v: sessionTotals.crashes,        c: sessionTotals.crashes > 0 ? C.red : "#555" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 16px", borderRight: "1px solid #1e1e1e", flexShrink: 0 }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: "#555", letterSpacing: "0.06em" }}>{s.l}</span>
              <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: "bold", color: s.c }}>{s.v}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          {realData && (
            <div style={{ padding: "0 14px", borderLeft: "1px solid #1e1e1e", flexShrink: 0 }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: "#22c55e", letterSpacing: "0.1em" }}>● NIFTY50 HISTORICAL DATA</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 14px", borderLeft: "1px solid #1e1e1e", flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#22c55e" : C.red, animation: connected ? "blink 2s infinite" : "none" }} />
            <span style={{ fontFamily: C.mono, fontSize: 9, color: connected ? "#22c55e" : C.red }}>{connected ? "LIVE" : "OFFLINE"}</span>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: "#333", marginLeft: 8 }}>TK{tick}</span>
          </div>
        </div>

        {/* ── NAV BAR ─────────────────────────────────────────────── */}
        <div style={{ background: C.nav, height: 50, display: "flex", alignItems: "center", padding: "0 24px", gap: 20 }}>
          <span style={{ fontFamily: C.serif, fontSize: 22, fontWeight: "bold", color: "#fff", letterSpacing: "-0.01em", marginRight: 8 }}>Orderly</span>
          <div style={{ width: 1, height: 22, background: "#333" }} />
          <span style={{ fontFamily: C.sans, fontSize: 11, color: "#777" }}>
            Trading Scheduler · OS Scheduling Algorithms Under Burst Load
          </span>
          <div style={{ flex: 1 }} />

          {/* Control buttons */}
          <button onClick={() => {
            fetch(`${API_BASE}/reset`).catch(() => {});
            setHistory([]);
            setPH([]);
            setEventLog([]);
            setSessionTotals({ processed: 0, rejected: 0, crashes: 0 });
            setAvg({ fcfs: "0.000", priority: "0.000", hybrid: "0.000" });
          }} style={{
            background: "transparent", color: "#aaa",
            border: "1px solid #444",
            fontFamily: C.sans, fontSize: 11, fontWeight: "bold",
            padding: "7px 16px", cursor: "pointer", letterSpacing: "0.06em",
          }}>↺ Reset</button>

          <button onClick={triggerCrash} style={{
            background: C.red, color: "#fff", border: "none",
            fontFamily: C.sans, fontSize: 11, fontWeight: "bold",
            padding: "7px 16px", cursor: "pointer", letterSpacing: "0.06em",
          }}>⚡ Trigger Crash</button>

          <button onClick={() => {
            const next = !autoCrash;
            setAutoCrash(next);
            fetch(`${API_BASE}/crash/auto/${next ? "on" : "off"}`).catch(() => {});
          }} style={{
            background: autoCrash ? C.amber : "transparent",
            color: autoCrash ? "#fff" : "#aaa",
            border: `1px solid ${autoCrash ? C.amber : "#444"}`,
            fontFamily: C.sans, fontSize: 11, fontWeight: "bold",
            padding: "7px 16px", cursor: "pointer", letterSpacing: "0.06em",
          }}>{autoCrash ? "■ Auto-Crash ON" : "⏱ Auto-Crash"}</button>

          <select value={selectedAlgo} onChange={e => setSelectedAlgo(e.target.value)} style={{
            background: "#1a1a1a", color: "#fff", border: "1px solid #444",
            fontFamily: C.sans, fontSize: 11, fontWeight: "bold",
            padding: "7px 12px", cursor: "pointer", letterSpacing: "0.06em",
          }}>
            <option value="fcfs">View: FCFS</option>
            <option value="priority">View: Priority</option>
            <option value="hybrid">View: Hybrid</option>
          </select>

          <button onClick={toggleStarvation} style={{
            background: starving ? C.purple : "transparent",
            color: starving ? "#fff" : "#aaa",
            border: `1px solid ${starving ? C.purple : "#444"}`,
            fontFamily: C.sans, fontSize: 11, fontWeight: "bold",
            padding: "7px 16px", cursor: "pointer", letterSpacing: "0.06em",
          }}>{starving ? "■ Restore Hybrid" : "▶ Starvation Demo"}</button>

          {isCrash && (
            <span style={{
              background: C.red, color: "#fff", fontFamily: C.sans, fontSize: 10,
              fontWeight: "bold", padding: "6px 14px", letterSpacing: "0.1em",
              animation: "blink 0.9s infinite",
            }}>● CRASH ACTIVE</span>
          )}
          {starving && (
            <span style={{ background: C.purple, color: "#fff", fontFamily: C.sans, fontSize: 10, fontWeight: "bold", padding: "6px 12px" }}>
              ⚠ STARVATION DEMO ON
            </span>
          )}
        </div>

        {/* ── PAGE TITLE + OS OVERVIEW ─────────────────────────────── */}
        <div style={{ padding: "22px 24px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 32, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: C.serif, fontSize: 30, fontWeight: "bold", letterSpacing: "-0.02em", marginBottom: 8, lineHeight: 1.1, color: C.text }}>
              Trading Scheduler — OS Scheduling Simulation
            </h1>
            <p style={{ fontFamily: C.sans, fontSize: 12, color: C.mid, lineHeight: 1.7, maxWidth: 620 }}>
              Simulates a high-frequency trading system where large volumes of orders arrive dynamically.
              Compares <strong>FCFS</strong>, <strong>Priority</strong>, and <strong>Hybrid</strong> scheduling
              under normal and crash (overload) conditions. Measures waiting time, queue size, and
              processing efficiency to demonstrate that Hybrid minimizes latency through Priority + Aging.
            </p>
          </div>
          {/* OS concept badges — always visible */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, minWidth: 300 }}>
            <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>OS Concept Mapping</div>
            {[
              { label: "FCFS",         desc: "Non-preemptive · FIFO queue · arrival order",           color: C.red    },
              { label: "Priority",     desc: "Max-heap · priority-first · starvation risk",            color: C.amber  },
              { label: "Hybrid",       desc: "MLFQ · priority + aging · no starvation",               color: C.green  },
              { label: "Queue Burst",  desc: "Ready-queue overflow · CPU overload analog",             color: C.purple },
              { label: "Semaphore",    desc: "Processing cap = 4 concurrent slots per queue",          color: C.mid    },
            ].map(({ label, desc, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Tag label={label} color={color} />
                <span style={{ fontFamily: C.sans, fontSize: 10, color: C.muted }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CRASH BANNER ─────────────────────────────────────────── */}
        {isCrash && (
          <div style={{
            background: C.redBg, borderBottom: `2px solid ${C.red}`,
            padding: "10px 24px", display: "flex", alignItems: "center", gap: 28,
            animation: "fadeIn 0.3s ease",
          }}>
            <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: "bold", color: C.red, flexShrink: 0 }}>● BURST LOAD EVENT</span>
            <span style={{ fontFamily: C.sans, fontSize: 12, color: C.mid }}>
              {tickStats.arrived} orders arrived this tick · {tickStats.processed_hybrid || 0} processed (Hybrid) · {tickStats.overflow || 0} overflow · queue depth: {queue}
            </span>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.muted, marginLeft: "auto", flexShrink: 0 }}>
              OS: ready-queue overflow · processing cap exceeded
            </span>
          </div>
        )}

        {starving && (
          <div style={{ background: C.purpleBg, borderBottom: `2px solid ${C.purple}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontFamily: C.sans, fontSize: 12, fontWeight: "bold", color: C.purple }}>⚠ STARVATION DEMO ACTIVE</span>
            <span style={{ fontFamily: C.sans, fontSize: 12, color: C.mid }}>
              Aging disabled — pure Priority mode. Watch P1/P2 Retail orders in the Priority lane collect "STARVING" labels.
              Disable to restore Hybrid aging — they will be promoted to P5 within ~4-5 seconds (aging: +1.0 priority/sec after 0.5s wait).
            </span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════════════════════════════════ */}
        <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── ROW 1: KPI Cards ─────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            <KPICard
              label={realData ? `Price · ${priceSource}` : "Simulated Price · GBM"}
              value={priceDisp}
              color={priceUp ? C.green : C.red}
              sub={priceUp ? "▲ price rising" : "▼ price falling"}
              accent={priceUp ? C.green : C.red}
            />
            <KPICard
              label="Queue Depth · Orders waiting"
              value={queue}
              color={queue > 30 ? C.red : C.green}
              sub={queue > 30 ? "⚠ OVERLOADED — above stress threshold" : "Normal — below threshold"}
              bg={queue > 30 ? C.redBg : C.bg}
              accent={queue > 30 ? C.red : C.green}
            />
            <KPICard label="FCFS Avg Wait" value={`${avg.fcfs}s`} color={C.red} sub="Non-preemptive · arrival order" accent={C.red} />
            <KPICard label="Priority Avg Wait" value={`${avg.priority}s`} color={C.amber} sub="Priority-first · starvation risk" accent={C.amber} />
            <KPICard label="Hybrid Avg Wait ★" value={`${avg.hybrid}s`} color={C.green} sub="MLFQ · Priority + Aging · best result" accent={C.green} bg={C.greenBg} />
            <KPICard
              label="Session Stats"
              value={sessionTotals.processed}
              color={C.mid}
              sub={`orders processed · ${sessionTotals.crashes} crashes · ${sessionTotals.rejected} rejected`}
              accent={C.mid}
            />
          </div>

          {/* ── ROW 2: Scheduler Lanes ───────────────────────────────── */}
          <div>
            <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `2px solid ${C.black}`, display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: C.serif, fontSize: 20, fontWeight: "bold" }}>Scheduler Lanes</span>
              <span style={{ fontFamily: C.sans, fontSize: 11, color: C.muted }}>
                Each algorithm runs on its own independent queue — identical orders arrive in all three · row 1 = next order dispatched · divergence appears under crash
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Lane
                name="FCFS — First Come First Served"
                osAnalog="Non-preemptive scheduling · FIFO queue · O(1) dequeue"
                color={C.red}
                metrics={metrics.fcfs}
                queueRows={fcfsQ}
                isBest={best === "fcfs"}
                starving={false}
                selected={selectedAlgo === "fcfs"}
                onSelect={() => setSelectedAlgo("fcfs")}
              />
              <Lane
                name="Priority Scheduling"
                osAnalog="Max-heap · O(log n) · higher priority dispatched first"
                color={C.amber}
                metrics={metrics.priority}
                queueRows={priQ}
                isBest={best === "priority"}
                starving={starving}
                selected={selectedAlgo === "priority"}
                onSelect={() => setSelectedAlgo("priority")}
              />
              <Lane
                name="Hybrid — Priority + Aging"
                osAnalog="MLFQ equivalent · aging prevents starvation · lowest wait"
                color={C.green}
                metrics={metrics.hybrid}
                queueRows={hybQ}
                isBest={best === "hybrid"}
                starving={false}
                selected={selectedAlgo === "hybrid"}
                onSelect={() => setSelectedAlgo("hybrid")}
              />
            </div>
          </div>

          {/* ── ROW 3: Charts ────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>

            {/* Wait time chart */}
            <Panel title="Wait Time Per Tick — Raw Unsmoothed Values" sub="each point = one scheduler tick · spikes visible during crash events" accent={C.black}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={ax} width={50} tickFormatter={v => `${v.toFixed(1)}s`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: C.sans, fontSize: 11, paddingTop: 8 }} formatter={v => v.toUpperCase()} />
                  <Line type="monotone" dataKey="fcfs"     stroke={C.red}   strokeWidth={2}   dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="priority" stroke={C.amber} strokeWidth={2}   strokeDasharray="6 3" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hybrid"   stroke={C.green} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 10, padding: "8px 12px", background: C.greenBg, border: `1px solid ${C.greenMd}` }}>
                <span style={{ fontFamily: C.sans, fontSize: 11, color: C.green }}>
                  <strong>What to observe:</strong> During crash events (FCFS spikes highest), Priority spikes moderately, Hybrid stays lowest — 
                  because aging ensures urgent orders don't monopolize the queue.
                </span>
              </div>
            </Panel>

            {/* Right column: price + queue stacked */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Panel title={realData ? "NIFTY50 Price" : "Simulated Price"} sub={priceSource} accent={C.amber} style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={priceHist} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={priceUp ? C.green : C.red} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={priceUp ? C.green : C.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" hide />
                    <YAxis tick={ax} width={50} tickFormatter={v => v > 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} />
                    <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.borderMd}`, fontSize: 10, fontFamily: C.mono }}
                      formatter={v => [`₹${Number(v).toLocaleString("en-IN")}`, realData ? "NIFTY50" : "price"]} />
                    <Area type="monotone" dataKey="price" stroke={priceUp ? C.green : C.red} strokeWidth={1.5}
                      fill="url(#priceGrad)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Queue Depth" sub="stress threshold = 30 orders" accent={C.red} style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.red} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={C.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" hide />
                    <YAxis tick={ax} width={30} />
                    <ReferenceLine y={30} stroke={C.red} strokeDasharray="5 3"
                      label={{ value: "stress", fill: C.red, fontSize: 8, fontFamily: C.mono, position: "insideTopRight" }} />
                    <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.borderMd}`, fontSize: 10, fontFamily: C.mono }}
                      formatter={v => [v, "queue depth"]} />
                    <Area type="monotone" dataKey="queue" stroke={C.red} strokeWidth={1.5}
                      fill="url(#queueGrad)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          </div>

          {/* ── ROW 3.5: Gantt Chart + System Load ──────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>

            {/* Gantt chart */}
            <Panel title="Hybrid Dispatch Timeline — Gantt Chart" sub="last 15 dispatches · color = priority · label = wait time at dispatch" accent={C.green} noPad>
              <div style={{ padding: "16px", display: "flex", gap: 4, overflowX: "auto", minHeight: 90, alignItems: "flex-end" }}>
                {gantt.length === 0
                  ? <div style={{ fontFamily: C.sans, fontSize: 11, color: C.muted, padding: "20px 0" }}>Awaiting dispatches…</div>
                  : gantt.map((g, i) => {
                    const pc = g.priority >= 5 ? C.red : g.priority >= 4 ? C.amber : g.priority >= 3 ? "#2563eb" : C.green;
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, minWidth: 52 }}>
                        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>#{g.order_id}</div>
                        <div style={{
                          width: 44, height: Math.max(20, Math.min(g.wait_at_dispatch * 14, 70)),
                          background: pc, borderRadius: 2,
                          display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 2,
                        }}>
                          <span style={{ fontFamily: C.mono, fontSize: 8, color: "#fff", fontWeight: "bold" }}>P{g.priority}</span>
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: 8, color: C.muted }}>{g.wait_at_dispatch}s</div>
                        <div style={{ fontFamily: C.sans, fontSize: 7, color: C.muted, textTransform: "uppercase" }}>{g.user_type?.slice(0,3)}</div>
                      </div>
                    );
                  })
                }
              </div>
              <div style={{ padding: "0 16px 14px", display: "flex", gap: 14 }}>
                {[["P5", C.red], ["P4", C.amber], ["P3", "#2563eb"], ["P1-2", C.green]].map(([l,c]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
                    <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>{l}</span>
                  </div>
                ))}
                <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, marginLeft: "auto" }}>
                  Bar height = wait time at dispatch — taller bars in low-priority colors prove aging is working
                </span>
              </div>
            </Panel>

            {/* System Load */}
            <Panel title="System Load %" sub="demand / capacity · >100% = overload" accent={C.purple}>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Current</div>
                  <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: "bold", color: systemLoad > 100 ? C.red : C.green }}>{systemLoad}%</div>
                </div>
                <div>
                  <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rolling Avg (20 ticks)</div>
                  <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: "bold", color: systemLoadAvg > 100 ? C.red : C.mid }}>{systemLoadAvg}%</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={loadHistory} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.purple} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={C.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={ax} width={36} tickFormatter={v => `${v}%`} />
                  <ReferenceLine y={100} stroke={C.red} strokeDasharray="4 3" label={{ value: "capacity", fill: C.red, fontSize: 8, fontFamily: C.mono, position: "insideTopRight" }} />
                  <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.borderMd}`, fontSize: 10, fontFamily: C.mono }} formatter={v => [`${v}%`, "load"]} />
                  <Area type="monotone" dataKey="load" stroke={C.purple} strokeWidth={1.5} fill="url(#loadGrad)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* ── ROW 4: Average bar chart + Order Book + Throughput ───── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

            {/* Bar chart */}
            <Panel title="Average Wait — All Schedulers" sub="lower = better · Hybrid should be shortest" accent={C.green}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={[
                    { name: "FCFS",     wait: Number(avg.fcfs),     fill: C.red   },
                    { name: "Priority", wait: Number(avg.priority), fill: C.amber },
                    { name: "Hybrid",   wait: Number(avg.hybrid),   fill: C.green },
                  ]}
                  margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                >
                  <XAxis dataKey="name" tick={ax} />
                  <YAxis tick={ax} width={44} tickFormatter={v => `${v.toFixed(1)}s`} />
                  <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.borderMd}`, fontSize: 10, fontFamily: C.mono }}
                    formatter={v => [`${Number(v).toFixed(3)}s`, "avg wait"]} />
                  <Bar dataKey="wait" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                    {[C.red, C.amber, C.green].map((c, i) => <Cell key={i} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                {["fcfs", "priority", "hybrid"].map((k, i) => {
                  const isBest = best === k;
                  const colors = [C.red, C.amber, C.green];
                  return (
                    <div key={k} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: "bold", color: colors[i] }}>{avg[k]}s</div>
                      {isBest && <Tag label="BEST" color={C.green} />}
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Order book */}
            <Panel title="Order Book" sub={`live queue · viewing: ${selectedAlgo.toUpperCase()}`} accent={C.black} noPad>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 48px 36px 60px", padding: "5px 12px", background: C.subtle, borderBottom: `1px solid ${C.border}` }}>
                {["ID", "QTY BAR", "QTY", "PRI", "TYPE"].map((h, i) => (
                  <span key={i} style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
                ))}
              </div>
              {(() => {
                const src = selectedAlgo === "fcfs" ? fcfsQ : selectedAlgo === "priority" ? priQ : hybQ;
                const buys  = src.filter(o => o.type === "BUY");
                const sells = src.filter(o => o.type === "SELL");
                const Row = (o, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr 48px 36px 60px", padding: "5px 12px", borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.bg : C.surface, alignItems: "center" }}>
                    <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted }}>#{o.order_id}</span>
                    <div style={{ height: 4, background: C.subtle }}>
                      <div style={{ width: `${Math.min(o.quantity / 2, 100)}%`, height: "100%", background: o.type === "BUY" ? C.green : C.red, opacity: 0.5 }} />
                    </div>
                    <span style={{ fontFamily: C.mono, fontSize: 10, color: C.mid, textAlign: "right" }}>{o.quantity}</span>
                    <Tag label={`P${o.priority}`} color={o.priority >= 4 ? C.red : o.priority >= 3 ? C.amber : C.muted} />
                    <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.user_type}</span>
                  </div>
                );
                return (
                  <>
                    <div style={{ borderBottom: `2px solid ${C.green}` }}>
                      <div style={{ padding: "5px 12px", background: C.greenBg }}>
                        <span style={{ fontFamily: C.sans, fontSize: 10, fontWeight: "bold", color: C.green }}>▲ BUY ORDERS — {buys.length}</span>
                      </div>
                      <div style={{ maxHeight: 110, overflowY: "auto" }}>
                        {buys.length === 0
                          ? <div style={{ padding: "10px 12px", fontFamily: C.sans, fontSize: 10, color: C.muted }}>No buy orders</div>
                          : buys.map(Row)}
                      </div>
                    </div>
                    <div>
                      <div style={{ padding: "5px 12px", background: C.redBg }}>
                        <span style={{ fontFamily: C.sans, fontSize: 10, fontWeight: "bold", color: C.red }}>▼ SELL ORDERS — {sells.length}</span>
                      </div>
                      <div style={{ maxHeight: 110, overflowY: "auto" }}>
                        {sells.length === 0
                          ? <div style={{ padding: "10px 12px", fontFamily: C.sans, fontSize: 10, color: C.muted }}>No sell orders</div>
                          : sells.map(Row)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </Panel>

            {/* Tick stats + event log */}
            <Panel title="System Log" sub="crash events · overflow · rejections" accent={C.red} noPad>
              {/* This tick */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
                {[
                  { l: "Arrived",   v: tickStats.arrived   || 0, c: C.mid },
                  { l: "Processed", v: tickStats.processed || 0, c: C.green },
                  { l: "Overflow",  v: tickStats.overflow  || 0, c: tickStats.overflow > 0 ? C.red : C.mid },
                  { l: "Total Crashes", v: sessionTotals.crashes, c: sessionTotals.crashes > 0 ? C.red : C.mid },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRight: i < 3 ? `1px solid ${C.border}` : "none", background: C.surface, textAlign: "center" }}>
                    <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{s.l}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: "bold", color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              {/* Log entries */}
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {eventLog.length === 0
                  ? <div style={{ padding: "20px 16px", fontFamily: C.sans, fontSize: 11, color: C.muted, textAlign: "center" }}>Awaiting events…</div>
                  : eventLog.map((entry, i) => (
                    <div key={i} style={{
                      padding: "8px 14px", borderBottom: `1px solid ${C.border}`,
                      background: entry.type === "crash" ? C.redBg : C.bg,
                      animation: "fadeIn 0.3s ease",
                    }}>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, marginBottom: 3 }}>{entry.ts}</div>
                      <div style={{ fontFamily: C.sans, fontSize: 10, color: entry.type === "crash" ? C.red : C.mid, lineHeight: 1.5 }}>{entry.msg}</div>
                    </div>
                  ))
                }
              </div>
            </Panel>
          </div>

          {/* ── ROW 5: Benchmark + OS Reference Table ───────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>

            {/* Benchmark */}
            <Panel title="Benchmark" sub="35s forced crash · real measured results" accent={C.black}>
              <p style={{ fontFamily: C.sans, fontSize: 11, color: C.mid, lineHeight: 1.6, marginBottom: 14 }}>
                Forces crash mode for 35 seconds. Fetches real wait time stats from backend timestamps.
                Use these numbers during your viva — they are measured, not fabricated.
              </p>
              <button onClick={runBenchmark} disabled={benchRunning} style={{
                width: "100%", padding: "10px 0",
                background: benchRunning ? C.subtle : C.black,
                color: benchRunning ? C.muted : "#fff",
                border: `1px solid ${benchRunning ? C.border : C.black}`,
                fontFamily: C.sans, fontSize: 12, fontWeight: "bold",
                cursor: benchRunning ? "not-allowed" : "pointer",
                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12,
              }}>{benchRunning ? "Running… (35s)" : "▶ Run Benchmark"}</button>

              {benchRunning && (
                <div style={{ padding: "8px 10px", background: C.amberBg, border: `1px solid ${C.amber}44`, fontFamily: C.mono, fontSize: 10, color: C.amber, marginBottom: 10 }}>
                  Forcing crash · recording timestamps…
                </div>
              )}

              {benchResult && !benchResult.error && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    Results — {benchResult.session?.crash_ticks}/{benchResult.session?.total_ticks} crash ticks ({benchResult.session?.crash_percentage}%)
                  </div>
                  {[
                    ["FCFS avg wait",     `${benchResult.average_wait?.fcfs}s`,                         C.red],
                    ["Priority avg wait", `${benchResult.average_wait?.priority}s`,                     C.amber],
                    ["Hybrid avg wait",   `${benchResult.average_wait?.hybrid}s`,                       C.green],
                    ["Hybrid vs FCFS",    `${benchResult.hybrid_improvement?.vs_fcfs_pct}% faster`,     C.green],
                    ["Hybrid vs Priority",`${benchResult.hybrid_improvement?.vs_priority_pct}% faster`, C.green],
                    ["P95 FCFS",          `${benchResult.p95_wait?.fcfs}s`,                             C.red],
                    ["P95 Hybrid",        `${benchResult.p95_wait?.hybrid}s`,                           C.green],
                  ].map(([l, v, c], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", background: i % 2 === 0 ? C.subtle : C.bg, border: `1px solid ${C.border}` }}>
                      <span style={{ fontFamily: C.sans, fontSize: 10, color: C.muted }}>{l}</span>
                      <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: "bold", color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {benchResult?.error && (
                <div style={{ fontFamily: C.sans, fontSize: 10, color: C.red }}>{benchResult.error}</div>
              )}
            </Panel>

            {/* OS Reference table */}
            <Panel title="OS Concept Reference — Complete Mapping" sub="every component mapped to operating systems theory" accent={C.black} noPad>
              <div style={{ display: "grid", gridTemplateColumns: "180px 200px 160px 1fr", background: C.subtle, borderBottom: `1px solid ${C.borderMd}` }}>
                {["OS Concept", "Trading Equivalent", "Algorithm", "Evidence in Dashboard"].map(h => (
                  <div key={h} style={{ padding: "8px 14px", fontFamily: C.sans, fontSize: 9, fontWeight: "bold", color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", borderRight: `1px solid ${C.border}` }}>{h}</div>
                ))}
              </div>
              {[
                ["CPU Ready Queue",      "Order Queue (up to 200)",        "All three",         "Queue Depth panel + chart",                         C.purple],
                ["FIFO / Non-preemptive","FCFS order dispatch",            "FCFS",              "FCFS lane — arrival-ordered rows",                  C.red],
                ["Priority Scheduling",  "Institutional > Retail",         "Priority",          "Priority lane — P5 HFT always at row 1",            C.amber],
                ["MLFQ",                 "Priority + Aging (Hybrid)",      "Hybrid",            "Hybrid lane — lowest wait, aging prevents starvation",C.green],
                ["Process Starvation",   "P1 orders never dispatched",     "Priority only",     "Starvation Demo button → STARVING labels",          C.red],
                ["Aging",                "+1.0 priority/sec after 0.5s wait","Hybrid",          "Hybrid outperforms Priority continuously",          C.green],
                ["Semaphore",            "Processing cap: 4 slots/tick per queue", "All",        "Tick stats: Arrived vs Processed vs Overflow",      C.mid],
                ["Burst Process Arrival","Crash: 8–15 orders/tick",        "All",               "Crash banner · queue spike · chart spikes",         C.red],
                ["Buffer Overflow",      "Orders rejected when queue=200", "All",               "Rejected counter in ticker bar",                    C.red],
                ["Throughput",           "Orders processed per tick",      "All",               "Processed counter · session total",                 C.green],
                ["Waiting Time",         "Wait time from arrival to pick", "All",               "Lane wait_time · chart · KPI cards",                C.amber],
                ["Starvation Fix",       "Hybrid beats Priority long-term","Hybrid",            "Bar chart + benchmark results",                     C.green],
              ].map(([os, trade, algo, evidence, color], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 200px 160px 1fr", background: i % 2 === 0 ? C.bg : C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ padding: "8px 14px", fontFamily: C.mono, fontSize: 10, fontWeight: "bold", color, borderRight: `1px solid ${C.border}` }}>{os}</div>
                  <div style={{ padding: "8px 14px", fontFamily: C.sans, fontSize: 10, color: C.mid, borderRight: `1px solid ${C.border}` }}>{trade}</div>
                  <div style={{ padding: "8px 14px", fontFamily: C.sans, fontSize: 10, color: C.mid, borderRight: `1px solid ${C.border}` }}>{algo}</div>
                  <div style={{ padding: "8px 14px", fontFamily: C.sans, fontSize: 10, color: C.muted }}>{evidence}</div>
                </div>
              ))}
            </Panel>
          </div>

        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <div style={{ borderTop: `2px solid ${C.black}`, padding: "12px 24px", background: C.nav, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: C.sans, fontSize: 11, color: "#666" }}>
            ORDERLY v3.0 · OS Scheduling PBL · FCFS vs Priority vs Hybrid (MLFQ) · {realData ? "NIFTY50 Historical Data" : "GBM Price Simulation"}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: "#444" }}>
            Processing cap: 4/tick per queue · Buffer: 200 · Crash: 15% probability (+auto-crash) · Aging: +1.0 priority/sec after 0.5s wait
          </span>
        </div>
      </div>
    </>
  );
}
