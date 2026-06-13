import { useEffect, useState, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
  BarChart, Bar, Cell, ComposedChart,
} from "recharts";

/* ─── Design tokens ───────────────────────────────────────────────────────
   Bloomberg/terminal aesthetic: white base, black headers, tight grid.
   ALL colors reference this object — never hardcoded elsewhere.
─────────────────────────────────────────────────────────────────────────── */
const C = {
  bg:       "#ffffff",
  surface:  "#fafafa",
  subtle:   "#f2f2f2",
  border:   "#e0e0e0",
  borderMd: "#c4c4c4",
  text:     "#0a0a0a",
  mid:      "#444444",
  muted:    "#888888",
  faint:    "#bbbbbb",

  fcfs:     "#b91c1c",   fcfsBg:  "#fff5f5",   fcfsMid: "#fca5a5",
  pri:      "#92400e",   priBg:   "#fffbeb",   priMid:  "#fcd34d",
  hyb:      "#065f46",   hybBg:   "#ecfdf5",   hybMid:  "#6ee7b7",
  purple:   "#4c1d95",   purpleBg:"#f5f3ff",
  blue:     "#1e3a5f",   blueBg:  "#eff6ff",

  black: "#000000",
  nav:   "#0a0a0a",
  tick:  "#060606",

  mono:  "'JetBrains Mono', 'Courier New', monospace",
  serif: "Georgia, 'Times New Roman', serif",
  sans:  "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

/* ─── Algo color map ──────────────────────────────────────────────────── */
const AC = {
  fcfs:     { stroke: C.fcfs,  fill: C.fcfsBg,  label: "FCFS"     },
  priority: { stroke: C.pri,   fill: C.priBg,   label: "PRIORITY" },
  hybrid:   { stroke: C.hyb,   fill: C.hybBg,   label: "HYBRID"   },
};

/* ─── Tiny reusable components ─────────────────────────────────────────── */
const Tag = ({ label, color, bg, size = 9 }) => (
  <span style={{
    fontFamily: C.sans, fontSize: size, fontWeight: 700,
    padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase",
    color, background: bg || color + "15",
    border: `1px solid ${color}35`, whiteSpace: "nowrap", borderRadius: 1,
  }}>{label}</span>
);

const Divider = ({ v }) => (
  <div style={{ width: v ? 1 : "100%", height: v ? 20 : 1, background: C.border, flexShrink: 0 }} />
);

const SectionHeader = ({ title, sub }) => (
  <div style={{ paddingBottom: 10, borderBottom: `2px solid ${C.black}`, marginBottom: 14, display: "flex", alignItems: "baseline", gap: 12 }}>
    <span style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 700, color: C.text }}>{title}</span>
    {sub && <span style={{ fontFamily: C.sans, fontSize: 11, color: C.muted }}>{sub}</span>}
  </div>
);

/* ─── KPI Card ─────────────────────────────────────────────────────────── */
const KPI = ({ label, value, sub, color = C.text, bg = C.bg, accent, mono = true }) => (
  <div style={{ background: bg, border: `1px solid ${C.border}`, borderTop: `3px solid ${accent || color}`, padding: "12px 14px" }}>
    <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
    <div style={{ fontFamily: mono ? C.mono : C.sans, fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

/* ─── Panel wrapper ────────────────────────────────────────────────────── */
const Panel = ({ title, sub, accent = C.black, right, children, noPad, style = {} }) => (
  <div style={{ border: `1px solid ${C.border}`, borderTop: `3px solid ${accent}`, background: C.bg, ...style }}>
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <span style={{ fontFamily: C.serif, fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
        {sub && <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>{sub}</span>}
      </div>
      {right}
    </div>
    <div style={noPad ? {} : { padding: 14 }}>{children}</div>
  </div>
);

/* ─── Chart tooltip ────────────────────────────────────────────────────── */
const ChartTip = ({ active, payload, unit = "s" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.borderMd}`, padding: "7px 11px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: C.mono, fontSize: 10, color: p.color, marginBottom: 1 }}>
          {String(p.name).toUpperCase()}: <span style={{ color: C.text }}>{Number(p.value).toFixed(3)}{unit}</span>
        </div>
      ))}
    </div>
  );
};
const ax = { fontFamily: C.mono, fontSize: 9, fill: C.muted };

/* ─── Gantt Chart (SVG) ────────────────────────────────────────────────── */
const GanttChart = ({ gantt }) => {
  if (!gantt || gantt.length === 0) {
    return (
      <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: C.sans, fontSize: 11, color: C.muted }}>Awaiting dispatch data…</span>
      </div>
    );
  }

  const W = 780, H = 130;
  const rowH = 20, rowGap = 4, padL = 36, padT = 8, padB = 20;
  const priorities = [5, 4, 3, 2, 1];
  const nRows = priorities.length;

  // group by tick
  const ticks = [...new Set(gantt.map(g => g.tick))].sort((a, b) => a - b);
  const minTick = ticks[0] ?? 0;
  const maxTick = ticks[ticks.length - 1] ?? 1;
  const tickSpan = Math.max(maxTick - minTick, 1);

  const xOf  = tick => padL + ((tick - minTick) / tickSpan) * (W - padL - 10);
  const yOf  = pri  => padT + (priorities.indexOf(pri)) * (rowH + rowGap);

  const userColor = { HFT: C.fcfs, Institution: C.pri, Retail: "#3b82f6" };

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 400 }}>
        {/* priority row labels */}
        {priorities.map(p => (
          <text key={p} x={padL - 6} y={yOf(p) + rowH / 2 + 4} textAnchor="end"
            style={{ fontFamily: C.mono, fontSize: 9, fill: C.muted }}>P{p}</text>
        ))}
        {/* row background stripes */}
        {priorities.map((p, i) => (
          <rect key={p} x={padL} y={yOf(p)} width={W - padL - 10} height={rowH}
            fill={i % 2 === 0 ? C.subtle : C.bg} />
        ))}
        {/* dispatch blocks */}
        {gantt.map((g, i) => {
          const x = xOf(g.tick);
          const y = yOf(g.priority);
          const w = Math.max(6, (W - padL - 10) / Math.max(tickSpan * 1.5, 12));
          const col = userColor[g.user_type] || C.muted;
          return (
            <g key={i}>
              <rect x={x - w / 2} y={y + 2} width={w} height={rowH - 4}
                fill={col} fillOpacity={0.85} rx={1} />
              {w > 10 && (
                <text x={x} y={y + rowH / 2 + 3} textAnchor="middle"
                  style={{ fontFamily: C.mono, fontSize: 7, fill: "#fff", fontWeight: 700 }}>
                  {g.priority}
                </text>
              )}
            </g>
          );
        })}
        {/* tick labels on X axis */}
        {ticks.filter((_, i) => i % Math.max(1, Math.floor(ticks.length / 8)) === 0).map(t => (
          <text key={t} x={xOf(t)} y={H - 4} textAnchor="middle"
            style={{ fontFamily: C.mono, fontSize: 8, fill: C.faint }}>
            T{t}
          </text>
        ))}
      </svg>
      {/* legend */}
      <div style={{ display: "flex", gap: 16, paddingTop: 4 }}>
        {[["HFT", C.fcfs], ["Institution", C.pri], ["Retail", "#3b82f6"]].map(([label, col]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, background: col, borderRadius: 1 }} />
            <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Scheduler Lane ───────────────────────────────────────────────────── */
const Lane = ({ name, algoKey, osAnalog, color, bg, metrics, queueRows, isBest, showAging }) => (
  <div style={{ border: `1px solid ${C.border}`, borderTop: `3px solid ${color}`, background: isBest ? bg : C.bg }}>
    {/* Header */}
    <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border}`, background: isBest ? bg : C.surface }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: C.sans, fontSize: 13, fontWeight: 700, color, marginBottom: 2 }}>{name}</div>
          <div style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>{osAnalog}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: isBest ? color : C.mid, lineHeight: 1 }}>
            {(metrics?.wait_time ?? 0).toFixed(3)}s
          </div>
          <div style={{ marginTop: 3 }}>
            {isBest
              ? <Tag label="BEST ★" color={color} />
              : <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>next wait</span>}
          </div>
        </div>
      </div>
    </div>

    {/* Sub-metrics */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
      {[
        { l: "Avg Wait",  v: `${(metrics?.avg_wait ?? 0).toFixed(3)}s`,  c: C.mid },
        { l: "Max Wait",  v: `${(metrics?.max_wait ?? 0).toFixed(2)}s`,  c: (metrics?.max_wait ?? 0) > 4 ? C.fcfs : C.mid },
        { l: "P95",       v: `${(metrics?.p95 ?? 0).toFixed(3)}s`,       c: (metrics?.p95 ?? 0) > 5 ? C.fcfs : C.mid },
        { l: "Starving",  v: metrics?.starving_count ?? 0,                c: (metrics?.starving_count ?? 0) > 0 ? C.fcfs : C.hyb },
      ].map((m, i) => (
        <div key={i} style={{ padding: "7px 10px", borderRight: i < 3 ? `1px solid ${C.border}` : "none", background: C.surface }}>
          <div style={{ fontFamily: C.sans, fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{m.l}</div>
          <div style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 700, color: m.c }}>{m.v}</div>
        </div>
      ))}
    </div>

    {/* Cumulative stats */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ padding: "5px 10px", borderRight: `1px solid ${C.border}` }}>
        <span style={{ fontFamily: C.sans, fontSize: 8, color: C.muted }}>PROCESSED: </span>
        <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.hyb }}>{(metrics?.cumulative_processed ?? 0).toLocaleString()}</span>
      </div>
      <div style={{ padding: "5px 10px" }}>
        <span style={{ fontFamily: C.sans, fontSize: 8, color: C.muted }}>REJECTED: </span>
        <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: (metrics?.cumulative_rejected ?? 0) > 0 ? C.fcfs : C.mid }}>
          {(metrics?.cumulative_rejected ?? 0).toLocaleString()}
        </span>
      </div>
    </div>

    {/* Queue rows */}
    <div style={{ padding: "8px 10px" }}>
      <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        Queue preview · sorted by {algoKey.toUpperCase()}
      </div>
      {(queueRows || []).slice(0, 6).map((o, i) => {
        const isStarving = (o.wait_age ?? 0) > 3 || (o.priority <= 2 && i >= 4);
        const hasBoost   = showAging && (o.aging_boost ?? 0) > 0.1;
        return (
          <div key={o.order_id} style={{
            display: "grid", gridTemplateColumns: "18px 46px 1fr 38px auto",
            gap: 5, alignItems: "center", padding: "4px 7px", marginBottom: 2,
            background: i === 0 ? color + "10" : C.bg,
            border: `1px solid ${i === 0 ? color + "45" : C.border}`,
          }}>
            <span style={{ fontFamily: C.mono, fontSize: 8, color: C.faint }}>{i + 1}</span>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.mid }}>#{o.order_id}</span>

            {/* quantity + optional aging bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ height: 3, background: C.subtle, borderRadius: 1 }}>
                <div style={{ width: `${Math.min((o.quantity / 200) * 100, 100)}%`, height: "100%", background: color, opacity: 0.4 }} />
              </div>
              {hasBoost && (
                <div style={{ height: 2, background: C.subtle, borderRadius: 1 }}>
                  <div style={{ width: `${Math.min((o.aging_boost / 4) * 100, 100)}%`, height: "100%", background: "#f59e0b" }} />
                </div>
              )}
            </div>

            <Tag label={`P${o.priority}`}
              color={o.priority >= 5 ? C.fcfs : o.priority >= 3 ? C.pri : C.muted} />

            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {isStarving && <Tag label="STARV" color={C.fcfs} size={7} />}
              {hasBoost && <Tag label={`+${o.aging_boost.toFixed(1)}`} color="#b45309" size={7} />}
              {!isStarving && !hasBoost && (
                <span style={{ fontFamily: C.sans, fontSize: 8, color: C.faint }}>{o.user_type}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/* ─── Dispatch Diff panel — the clearest proof of divergence ───────────── */
const DispatchDiff = ({ fcfsDispatched, priDispatched, hybDispatched }) => {
  const cols = [
    { key: "fcfs",     label: "FCFS dispatched",     color: C.fcfs,  note: "Oldest 4 regardless of priority", items: fcfsDispatched },
    { key: "priority", label: "Priority dispatched",  color: C.pri,   note: "Highest 4 priority, ignores age",  items: priDispatched  },
    { key: "hybrid",   label: "Hybrid dispatched",    color: C.hyb,   note: "Aging-boosted priority",           items: hybDispatched  },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, border: `1px solid ${C.border}` }}>
      {cols.map(({ key, label, color, note, items }) => (
        <div key={key} style={{ borderRight: `1px solid ${C.border}` }}>
          <div style={{ padding: "7px 10px", background: color + "0c", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.sans, fontSize: 10, fontWeight: 700, color }}>{label}</div>
            <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, marginTop: 1 }}>{note}</div>
          </div>
          <div style={{ padding: "6px 8px", minHeight: 60 }}>
            {(items || []).length === 0
              ? <span style={{ fontFamily: C.sans, fontSize: 9, color: C.faint }}>—</span>
              : (items || []).map((o, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <Tag label={`P${o.priority}`}
                    color={o.priority >= 5 ? C.fcfs : o.priority >= 3 ? C.pri : C.muted}
                    size={8} />
                  <span style={{ fontFamily: C.mono, fontSize: 8, color: C.mid }}>#{o.order_id}</span>
                  <span style={{ fontFamily: C.sans, fontSize: 8, color: C.faint }}>{o.user_type}</span>
                </div>
              ))
            }
          </div>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {

  /* ── state ── */
  const [price, setPrice]       = useState(22000);
  const [prevPrice, setPrev]    = useState(22000);
  const [isCrash, setIsCrash]   = useState(false);
  const [connected, setConn]    = useState(false);
  const [tick, setTick]         = useState(0);
  const [realData, setRealData] = useState(false);
  const [priceSrc, setPriceSrc] = useState("GBM simulation");
  const [best, setBest]         = useState("hybrid");
  const [mode, setMode]         = useState("normal");
  const [starving, setStarving] = useState(false);

  // metrics — updated every tick but display values throttled
  const [metrics, setMetrics]   = useState({ fcfs: {}, priority: {}, hybrid: {} });
  const [fcfsQ, setFcfsQ]       = useState([]);
  const [priQ, setPriQ]         = useState([]);
  const [hybQ, setHybQ]         = useState([]);
  const [gantt, setGantt]       = useState([]);
  const [tickStats, setTickStats] = useState({});
  const [buyOrders, setBuy]     = useState([]);
  const [sellOrders, setSell]   = useState([]);

  // throttled display KPIs (update every 2 ticks to reduce flicker)
  const [dispMetrics, setDispMetrics] = useState({ fcfs: {}, priority: {}, hybrid: {} });
  const [queueDepth, setQueueDepth]   = useState(0);
  const [sysLoad, setSysLoad]         = useState(0);

  // session totals
  const [session, setSession] = useState({ processed: 0, rejected: 0, crashes: 0 });

  // chart history
  const [history, setHistory]   = useState([]);   // wait time + queue
  const [priceHist, setPH]      = useState([]);
  const [loadHist, setLoadHist] = useState([]);

  // benchmark
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResult, setBenchResult]   = useState(null);
  const [eventLog, setEventLog]         = useState([]);

  // last dispatched per algo for divergence panel
  const [lastDispatched, setLastDispatched] = useState({ fcfs: [], priority: [], hybrid: [] });

  const tickRef      = useRef(0);
  const displayTimer = useRef(0);

  /* ── backend info fetch ── */
  useEffect(() => {
    fetch("http://127.0.0.1:8000/")
      .then(r => r.json())
      .then(d => { setRealData(!!d.real_data_active); setPriceSrc(d.price_source || "GBM"); })
      .catch(() => {});
  }, []);

  /* ── WebSocket ── */
  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");
    ws.onopen  = () => setConn(true);
    ws.onclose = () => setConn(false);
    ws.onerror = () => setConn(false);

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      tickRef.current++;
      const t = tickRef.current;
      setTick(t);

      setPrice(p => { setPrev(p); return d.price; });
      setIsCrash(!!d.crash);
      if (d.best)  setBest(d.best);
      if (d.mode)  setMode(d.mode);

      setMetrics({ fcfs: d.fcfs || {}, priority: d.priority || {}, hybrid: d.hybrid || {} });
      setFcfsQ(d.fcfs_queue     || []);
      setPriQ(d.priority_queue  || []);
      setHybQ(d.hybrid_queue    || []);
      setTickStats(d.tick_stats || {});
      setBuy(d.buy_orders   || []);
      setSell(d.sell_orders || []);
      if (d.gantt?.length) setGantt(d.gantt);

      // last dispatched for divergence panel
      setLastDispatched({
        fcfs:     d.fcfs?.last_dispatched     || [],
        priority: d.priority?.last_dispatched || [],
        hybrid:   d.hybrid?.last_dispatched   || [],
      });

      // throttle display KPIs: update every 2 ticks
      displayTimer.current++;
      if (displayTimer.current >= 2) {
        displayTimer.current = 0;
        setDispMetrics({ fcfs: d.fcfs || {}, priority: d.priority || {}, hybrid: d.hybrid || {} });
        setQueueDepth(d.queue_length ?? 0);
        setSysLoad(d.system_load ?? 0);
      }

      // chart history — every tick, keep last 120 points
      const fw = Number(d.fcfs?.wait_time     || 0);
      const pw = Number(d.priority?.wait_time || 0);
      const hw = Number(d.hybrid?.wait_time   || 0);
      const mf = Number(d.fcfs?.max_wait      || 0);
      const mp = Number(d.priority?.max_wait  || 0);
      const mh = Number(d.hybrid?.max_wait    || 0);

      setHistory(h => [...h.slice(-120), {
        t, fcfs: fw, priority: pw, hybrid: hw,
        fcfs_max: mf, pri_max: mp, hyb_max: mh,
        queue: d.queue_length ?? 0,
        load: d.system_load ?? 0,
        crash: d.crash ? 1 : 0,
      }]);
      setPH(h => [...h.slice(-120), { t, price: d.price }]);
      setLoadHist(h => [...h.slice(-120), { t, load: d.system_load ?? 0, crash: d.crash ? 120 : 0 }]);

      // session totals
      setSession(prev => ({
        processed: prev.processed + (d.tick_stats?.processed_hybrid || 0),
        rejected:  prev.rejected  + (d.tick_stats?.overflow || 0),
        crashes:   prev.crashes   + (d.crash ? 1 : 0),
      }));

      // event log (crash only)
      if (d.crash) {
        const ts = new Date().toLocaleTimeString("en-IN", { hour12: false });
        setEventLog(l => [{
          ts,
          msg: `BURST · arrived ${d.tick_stats?.arrived}  ·  hybrid processed ${d.tick_stats?.processed_hybrid || 0}  ·  overflow ${d.tick_stats?.overflow || 0}  ·  depth ${d.queue_length ?? 0}`,
        }, ...l.slice(0, 9)]);
      }
    };

    return () => ws.close();
  }, []);

  /* ── actions ── */
  const triggerCrash = useCallback(() => fetch("http://127.0.0.1:8000/crash/trigger").catch(() => {}), []);

  const toggleStarvation = useCallback(() => {
    const next = !starving;
    setStarving(next);
    fetch(`http://127.0.0.1:8000/mode/${next ? "priority_only" : "normal"}`).catch(() => {});
  }, [starving]);

  const doReset = useCallback(() => {
    fetch("http://127.0.0.1:8000/reset").catch(() => {});
    setHistory([]); setPH([]); setLoadHist([]); setEventLog([]);
    setSession({ processed: 0, rejected: 0, crashes: 0 });
    setBenchResult(null);
  }, []);

  const runBenchmark = useCallback(async () => {
    setBenchRunning(true);
    setBenchResult(null);
    try { await fetch("http://127.0.0.1:8000/benchmark/start"); } catch (_) {}
    await new Promise(r => setTimeout(r, 41000));
    try {
      const res = await fetch("http://127.0.0.1:8000/stats");
      setBenchResult(await res.json());
    } catch (_) {
      setBenchResult({ error: "Backend unreachable at /stats" });
    }
    setBenchRunning(false);
  }, []);

  /* ── derived display values ── */
  const priceUp   = price >= prevPrice;
  const priceDisp = price > 1000
    ? `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `₹${price.toFixed(2)}`;

  /* ─────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        * { box-sizing:border-box; margin:0; padding:0; }
        html,body { background:${C.bg}; color:${C.text}; font-family:${C.sans}; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:${C.subtle}; }
        ::-webkit-scrollbar-thumb { background:${C.borderMd}; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg }}>

        {/* ══ TICKER BAR ═══════════════════════════════════════════════ */}
        <div style={{ background: C.tick, height: 32, display: "flex", alignItems: "center", overflowX: "auto", gap: 0 }}>
          <div style={{ padding: "0 16px", borderRight: "1px solid #1a1a1a", flexShrink: 0 }}>
            <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.2em" }}>ORDERLY</span>
          </div>
          {[
            { l: realData ? "NIFTY50" : "SIM",   v: priceDisp,                  c: priceUp ? "#22c55e" : C.fcfs },
            { l: "QUEUE",                          v: queueDepth,                 c: queueDepth > 30 ? C.fcfs : "#22c55e" },
            { l: "LOAD",                           v: `${sysLoad.toFixed(0)}%`,  c: sysLoad > 100 ? C.fcfs : sysLoad > 80 ? "#f59e0b" : "#22c55e" },
            { l: "FCFS AVG",                       v: `${(dispMetrics.fcfs?.avg_wait ?? 0).toFixed(3)}s`, c: C.fcfs },
            { l: "PRI AVG",                        v: `${(dispMetrics.priority?.avg_wait ?? 0).toFixed(3)}s`, c: "#f59e0b" },
            { l: "HYB AVG",                        v: `${(dispMetrics.hybrid?.avg_wait ?? 0).toFixed(3)}s`, c: "#22c55e" },
            { l: "PROCESSED",                      v: session.processed,          c: "#666" },
            { l: "CRASHES",                        v: session.crashes,            c: session.crashes > 0 ? C.fcfs : "#333" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "0 14px", borderRight: "1px solid #1a1a1a", flexShrink: 0 }}>
              <span style={{ fontFamily: C.mono, fontSize: 8, color: "#444", letterSpacing: "0.06em" }}>{s.l}</span>
              <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: s.c }}>{s.v}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", borderLeft: "1px solid #1a1a1a", flexShrink: 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#22c55e" : C.fcfs, animation: connected ? "blink 2.5s infinite" : "none" }} />
            <span style={{ fontFamily: C.mono, fontSize: 9, color: connected ? "#22c55e" : C.fcfs }}>{connected ? "LIVE" : "OFFLINE"}</span>
            <span style={{ fontFamily: C.mono, fontSize: 8, color: "#333", marginLeft: 8 }}>TK{tick}</span>
          </div>
        </div>

        {/* ══ NAV ══════════════════════════════════════════════════════ */}
        <div style={{ background: C.nav, height: 48, display: "flex", alignItems: "center", padding: "0 20px", gap: 16 }}>
          <span style={{ fontFamily: C.serif, fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Orderly</span>
          <Divider v />
          <span style={{ fontFamily: C.sans, fontSize: 10, color: "#666" }}>OS Scheduling Simulation · FCFS vs Priority vs Hybrid (MLFQ)</span>
          <div style={{ flex: 1 }} />

          <button onClick={doReset} style={{ background: "transparent", color: "#777", border: "1px solid #333", fontFamily: C.sans, fontSize: 10, fontWeight: 700, padding: "6px 14px", cursor: "pointer", letterSpacing: "0.06em" }}>
            ↺ RESET
          </button>
          <button onClick={triggerCrash} style={{ background: C.fcfs, color: "#fff", border: "none", fontFamily: C.sans, fontSize: 10, fontWeight: 700, padding: "6px 14px", cursor: "pointer", letterSpacing: "0.06em" }}>
            ⚡ CRASH
          </button>
          <button onClick={toggleStarvation} style={{ background: starving ? C.purple : "transparent", color: starving ? "#fff" : "#888", border: `1px solid ${starving ? C.purple : "#333"}`, fontFamily: C.sans, fontSize: 10, fontWeight: 700, padding: "6px 14px", cursor: "pointer", letterSpacing: "0.06em" }}>
            {starving ? "■ RESTORE" : "▶ STARVATION"}
          </button>

          {isCrash && (
            <span style={{ background: C.fcfs, color: "#fff", fontFamily: C.mono, fontSize: 9, fontWeight: 700, padding: "5px 12px", letterSpacing: "0.1em", animation: "blink 1s infinite" }}>
              ● BURST
            </span>
          )}
          {starving && (
            <span style={{ background: C.purple, color: "#fff", fontFamily: C.mono, fontSize: 9, fontWeight: 700, padding: "5px 12px" }}>
              ⚠ STARVATION DEMO
            </span>
          )}
        </div>

        {/* ══ CRASH / STARVATION BANNERS ════════════════════════════════ */}
        {isCrash && (
          <div style={{ background: C.fcfsBg, borderBottom: `2px solid ${C.fcfs}`, padding: "8px 20px", display: "flex", alignItems: "center", gap: 24, animation: "slideIn 0.25s ease" }}>
            <span style={{ fontFamily: C.sans, fontSize: 11, fontWeight: 700, color: C.fcfs, flexShrink: 0 }}>● BURST LOAD EVENT</span>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.mid }}>
              {tickStats.arrived} arrived · {tickStats.processed_hybrid || 0} dispatched (Hybrid) · {tickStats.overflow || 0} overflow · depth {queueDepth}
            </span>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.faint, marginLeft: "auto", flexShrink: 0 }}>OS analog: ready-queue overflow · CPU overload</span>
          </div>
        )}
        {starving && (
          <div style={{ background: C.purpleBg, borderBottom: `2px solid ${C.purple}`, padding: "8px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontFamily: C.sans, fontSize: 11, fontWeight: 700, color: C.purple }}>⚠ STARVATION DEMO</span>
            <span style={{ fontFamily: C.sans, fontSize: 10, color: C.mid }}>
              Aging disabled on Hybrid — now behaves identically to Priority. Watch STARV labels on P1/P2 Retail orders. Toggle off to restore aging — they recover within 3 ticks.
            </span>
          </div>
        )}

        {/* ══ MAIN CONTENT ════════════════════════════════════════════ */}
        <div style={{ padding: "18px 20px 40px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── ROW 1: Title + OS concept map ───────────────────────── */}
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start", paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: C.serif, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6, color: C.text }}>
                Trading Scheduler — OS Scheduling Simulation
              </h1>
              <p style={{ fontFamily: C.sans, fontSize: 11, color: C.mid, lineHeight: 1.7, maxWidth: 580 }}>
                Models a high-frequency trading order queue as a CPU ready queue. Three independent
                scheduling algorithms — <strong>FCFS</strong>, <strong>Priority</strong>, and <strong>Hybrid (MLFQ)</strong> — 
                process identical order streams under normal and burst load. Metrics prove Hybrid minimises
                both average wait and tail latency through Priority + Aging.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>OS Concept Map</div>
              {[
                { label: "FCFS",        desc: "Non-preemptive · FIFO · arrival order",            color: C.fcfs   },
                { label: "Priority",    desc: "Max-heap · P5 first · starvation risk",             color: C.pri    },
                { label: "Hybrid",      desc: "MLFQ · priority + aging · starvation-free",        color: C.hyb    },
                { label: "Burst Load",  desc: "Ready-queue overflow · CPU overload analog",        color: C.purple },
                { label: "Semaphore",   desc: "Processing cap = 4 slots per queue per tick",       color: C.mid    },
                { label: "Aging",       desc: "+0.8 priority/s after 1.5s wait · cap at P5",      color: "#b45309" },
              ].map(({ label, desc, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Tag label={label} color={color} />
                  <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── ROW 2: KPI Cards ────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            <KPI label={realData ? "NIFTY50 Price" : "Simulated Price · GBM"}
              value={priceDisp} color={priceUp ? C.hyb : C.fcfs}
              sub={priceUp ? "▲ rising" : "▼ falling"} accent={priceUp ? C.hyb : C.fcfs} />
            <KPI label="Queue Depth" value={queueDepth}
              color={queueDepth > 30 ? C.fcfs : C.hyb}
              sub={queueDepth > 30 ? "⚠ overloaded" : "normal"}
              bg={queueDepth > 30 ? C.fcfsBg : C.bg}
              accent={queueDepth > 30 ? C.fcfs : C.hyb} />
            <KPI label="System Load" value={`${sysLoad.toFixed(0)}%`}
              color={sysLoad > 100 ? C.fcfs : sysLoad > 80 ? "#b45309" : C.hyb}
              sub="arrivals / capacity" accent={sysLoad > 100 ? C.fcfs : C.pri} />
            <KPI label="FCFS Avg Wait" value={`${(dispMetrics.fcfs?.avg_wait ?? 0).toFixed(3)}s`}
              color={C.fcfs} sub={`P95: ${(dispMetrics.fcfs?.p95 ?? 0).toFixed(3)}s`} accent={C.fcfs} />
            <KPI label="Priority Avg Wait" value={`${(dispMetrics.priority?.avg_wait ?? 0).toFixed(3)}s`}
              color={C.pri} sub={`P95: ${(dispMetrics.priority?.p95 ?? 0).toFixed(3)}s`} accent={C.pri} />
            <KPI label="Hybrid Avg Wait ★" value={`${(dispMetrics.hybrid?.avg_wait ?? 0).toFixed(3)}s`}
              color={C.hyb} sub={`P95: ${(dispMetrics.hybrid?.p95 ?? 0).toFixed(3)}s`}
              accent={C.hyb} bg={C.hybBg} />
            <KPI label="Session" value={session.processed}
              color={C.mid} sub={`${session.crashes} crashes · ${session.rejected} overflow`} accent={C.mid} />
          </div>

          {/* ── ROW 3: Scheduler Lanes ──────────────────────────────── */}
          <div>
            <SectionHeader
              title="Scheduler Lanes"
              sub="Independent queues — identical arrivals — sort order determines who gets dispatched · divergence visible under load" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Lane name="FCFS — First Come First Served" algoKey="fcfs"
                osAnalog="Non-preemptive · FIFO · O(n log n) sort by arrival_time"
                color={C.fcfs} bg={C.fcfsBg}
                metrics={dispMetrics.fcfs} queueRows={fcfsQ}
                isBest={best === "fcfs"} showAging={false} />
              <Lane name="Priority Scheduling" algoKey="priority"
                osAnalog="Max-heap · O(n log n) · highest priority dispatched first"
                color={C.pri} bg={C.priBg}
                metrics={dispMetrics.priority} queueRows={priQ}
                isBest={best === "priority"} showAging={false} />
              <Lane name="Hybrid — Priority + Aging" algoKey="hybrid"
                osAnalog="MLFQ equivalent · aging boost prevents starvation · lowest tail latency"
                color={C.hyb} bg={C.hybBg}
                metrics={dispMetrics.hybrid} queueRows={hybQ}
                isBest={best === "hybrid"} showAging={true} />
            </div>
          </div>

          {/* ── ROW 4: Dispatch Divergence proof ────────────────────── */}
          <Panel title="This Tick — Who Got Dispatched?" accent={C.black}
            sub="The key proof: same orders arrive in all three queues — different sort algorithms dispatch different subsets">
            <DispatchDiff
              fcfsDispatched={lastDispatched.fcfs}
              priDispatched={lastDispatched.priority}
              hybDispatched={lastDispatched.hybrid} />
          </Panel>

          {/* ── ROW 5: Charts ───────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>

            {/* Wait time — 3 lines, crash zones */}
            <Panel title="Next-Order Wait Time Per Tick" accent={C.black}
              sub="raw per-tick values · crash ticks shaded red · 3 distinct lines when queue depth > 5">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={history} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={ax} width={46} tickFormatter={v => `${v.toFixed(1)}s`} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontFamily: C.sans, fontSize: 10, paddingTop: 6 }} formatter={v => v.toUpperCase()} />
                  {/* crash zone shading */}
                  <Area dataKey="crash" fill={C.fcfs} fillOpacity={0.06} stroke="none" isAnimationActive={false} legendType="none" />
                  <Line type="monotone" dataKey="fcfs"     stroke={C.fcfs} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="priority" stroke={C.pri}  strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hybrid"   stroke={C.hyb}  strokeWidth={2}   dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8, padding: "6px 10px", background: C.hybBg, border: `1px solid ${C.hybMid}` }}>
                <span style={{ fontFamily: C.sans, fontSize: 10, color: C.hyb }}>
                  <strong>Key observation:</strong> Under burst load (red shaded zones) FCFS spikes highest because it 
                  dispatches old low-priority orders first. Priority spikes moderately. Hybrid stays lowest via aging.
                </span>
              </div>
            </Panel>

            {/* Right col: price + queue depth */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Panel title={realData ? "NIFTY50" : "Price (GBM Simulation)"} sub={priceSrc} accent={C.pri} style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height={88}>
                  <AreaChart data={priceHist} margin={{ top: 2, right: 6, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={priceUp ? C.hyb : C.fcfs} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={priceUp ? C.hyb : C.fcfs} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" hide />
                    <YAxis tick={ax} width={46} tickFormatter={v => v > 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)} />
                    <Tooltip contentStyle={{ fontFamily: C.mono, fontSize: 9, background: C.bg, border: `1px solid ${C.borderMd}` }}
                      formatter={v => [`₹${Number(v).toLocaleString("en-IN")}`, ""]} />
                    <Area type="monotone" dataKey="price" stroke={priceUp ? C.hyb : C.fcfs} strokeWidth={1.5}
                      fill="url(#pg)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Queue Depth" sub="stress line at 30" accent={C.fcfs} style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height={88}>
                  <AreaChart data={history} margin={{ top: 2, right: 6, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="qg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.fcfs} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={C.fcfs} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" hide />
                    <YAxis tick={ax} width={28} />
                    <ReferenceLine y={30} stroke={C.fcfs} strokeDasharray="4 3"
                      label={{ value: "stress", fill: C.fcfs, fontSize: 8, fontFamily: C.mono, position: "insideTopRight" }} />
                    <Tooltip contentStyle={{ fontFamily: C.mono, fontSize: 9, background: C.bg, border: `1px solid ${C.borderMd}` }}
                      formatter={v => [v, "depth"]} />
                    <Area type="monotone" dataKey="queue" stroke={C.fcfs} strokeWidth={1.5}
                      fill="url(#qg)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          </div>

          {/* ── ROW 6: Max-Wait chart + Avg bar + System load ───────── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>

            {/* Max wait — starvation proof chart */}
            <Panel title="Max Wait Time (Starvation Indicator)" accent={C.fcfs}
              sub="max_wait grows unboundedly for Priority under load · Hybrid keeps it bounded via aging">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={history} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={ax} width={46} tickFormatter={v => `${v.toFixed(1)}s`} />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontFamily: C.sans, fontSize: 10, paddingTop: 6 }} />
                  <Line type="monotone" dataKey="fcfs_max" name="FCFS max"     stroke={C.fcfs} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="pri_max"  name="Priority max" stroke={C.pri}  strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="hyb_max"  name="Hybrid max"   stroke={C.hyb}  strokeWidth={2}   dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            {/* Avg wait bar */}
            <Panel title="Avg Wait — Live" sub="lower = better" accent={C.hyb}>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={[
                  { name: "FCFS",     v: dispMetrics.fcfs?.avg_wait     ?? 0 },
                  { name: "Priority", v: dispMetrics.priority?.avg_wait ?? 0 },
                  { name: "Hybrid",   v: dispMetrics.hybrid?.avg_wait   ?? 0 },
                ]} margin={{ top: 6, right: 6, bottom: 4, left: 0 }}>
                  <XAxis dataKey="name" tick={ax} />
                  <YAxis tick={ax} width={40} tickFormatter={v => `${v.toFixed(1)}s`} />
                  <Tooltip contentStyle={{ fontFamily: C.mono, fontSize: 9, background: C.bg, border: `1px solid ${C.borderMd}` }}
                    formatter={v => [`${Number(v).toFixed(4)}s`, "avg wait"]} />
                  <Bar dataKey="v" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                    {[C.fcfs, C.pri, C.hyb].map((c, i) => <Cell key={i} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: 4 }}>
                {[["fcfs", C.fcfs], ["priority", C.pri], ["hybrid", C.hyb]].map(([k, c]) => (
                  <div key={k} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: c }}>
                      {(dispMetrics[k]?.avg_wait ?? 0).toFixed(3)}s
                    </div>
                    {best === k && <Tag label="BEST" color={C.hyb} size={8} />}
                  </div>
                ))}
              </div>
            </Panel>

            {/* System load */}
            <Panel title="System Load %" sub="arrived / capacity · >100% = overload" accent={C.pri}>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={loadHist} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.pri} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={C.pri} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis tick={ax} width={34} tickFormatter={v => `${v}%`} />
                  <ReferenceLine y={100} stroke={C.fcfs} strokeDasharray="4 3"
                    label={{ value: "100%", fill: C.fcfs, fontSize: 8, fontFamily: C.mono, position: "insideTopRight" }} />
                  <Tooltip contentStyle={{ fontFamily: C.mono, fontSize: 9, background: C.bg, border: `1px solid ${C.borderMd}` }}
                    formatter={v => [`${v}%`, "load"]} />
                  <Area type="monotone" dataKey="load" stroke={C.pri} strokeWidth={1.5}
                    fill="url(#lg)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 4, fontFamily: C.mono, fontSize: 10, textAlign: "center", color: sysLoad > 100 ? C.fcfs : C.hyb, fontWeight: 700 }}>
                {sysLoad.toFixed(1)}% current
              </div>
            </Panel>
          </div>

          {/* ── ROW 7: Gantt + Order Book + System Log ──────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>

            {/* Gantt */}
            <Panel title="Hybrid Execution Timeline (Gantt)" accent={C.hyb}
              sub="each bar = one dispatched order · Y = priority level · colored by user type · last 20 dispatches">
              <GanttChart gantt={gantt} />
            </Panel>

            {/* Order book */}
            <Panel title="Order Book" sub="BUY / SELL · sampled from Hybrid queue" accent={C.black} noPad>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ padding: "4px 10px", background: C.hybBg, borderRight: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: C.sans, fontSize: 9, fontWeight: 700, color: C.hyb }}>▲ BUY ({buyOrders.length})</span>
                </div>
                <div style={{ padding: "4px 10px", background: C.fcfsBg }}>
                  <span style={{ fontFamily: C.sans, fontSize: 9, fontWeight: 700, color: C.fcfs }}>▼ SELL ({sellOrders.length})</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ borderRight: `1px solid ${C.border}`, maxHeight: 220, overflowY: "auto" }}>
                  {buyOrders.length === 0
                    ? <div style={{ padding: "12px 10px", fontFamily: C.sans, fontSize: 9, color: C.faint }}>—</div>
                    : buyOrders.map((o, i) => (
                      <div key={i} style={{ padding: "4px 8px", borderBottom: `1px solid ${C.border}`, background: i % 2 ? C.surface : C.bg, display: "flex", alignItems: "center", gap: 5 }}>
                        <Tag label={`P${o.priority}`} color={o.priority >= 4 ? C.fcfs : o.priority >= 3 ? C.pri : C.muted} size={8} />
                        <span style={{ fontFamily: C.mono, fontSize: 8, color: C.mid }}>{o.quantity}</span>
                        <span style={{ fontFamily: C.sans, fontSize: 8, color: C.faint }}>{o.user_type}</span>
                      </div>
                    ))
                  }
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {sellOrders.length === 0
                    ? <div style={{ padding: "12px 10px", fontFamily: C.sans, fontSize: 9, color: C.faint }}>—</div>
                    : sellOrders.map((o, i) => (
                      <div key={i} style={{ padding: "4px 8px", borderBottom: `1px solid ${C.border}`, background: i % 2 ? C.surface : C.bg, display: "flex", alignItems: "center", gap: 5 }}>
                        <Tag label={`P${o.priority}`} color={o.priority >= 4 ? C.fcfs : o.priority >= 3 ? C.pri : C.muted} size={8} />
                        <span style={{ fontFamily: C.mono, fontSize: 8, color: C.mid }}>{o.quantity}</span>
                        <span style={{ fontFamily: C.sans, fontSize: 8, color: C.faint }}>{o.user_type}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </Panel>

            {/* System log */}
            <Panel title="System Log" sub="crash events only" accent={C.fcfs} noPad>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.border}` }}>
                {[
                  { l: "Arrived",  v: tickStats.arrived   || 0, c: C.mid   },
                  { l: "Overflow", v: tickStats.overflow  || 0, c: (tickStats.overflow || 0) > 0 ? C.fcfs : C.mid },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "8px 10px", borderRight: i === 0 ? `1px solid ${C.border}` : "none", background: C.surface, textAlign: "center" }}>
                    <div style={{ fontFamily: C.sans, fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{s.l}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {eventLog.length === 0
                  ? <div style={{ padding: "16px 12px", fontFamily: C.sans, fontSize: 10, color: C.faint, textAlign: "center" }}>Awaiting crash events…</div>
                  : eventLog.map((entry, i) => (
                    <div key={i} style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}`, background: i === 0 ? C.fcfsBg : C.bg, animation: i === 0 ? "slideIn 0.3s ease" : "none" }}>
                      <div style={{ fontFamily: C.mono, fontSize: 8, color: C.faint, marginBottom: 2 }}>{entry.ts}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 9, color: C.fcfs, lineHeight: 1.5 }}>{entry.msg}</div>
                    </div>
                  ))
                }
              </div>
            </Panel>
          </div>

          {/* ── ROW 8: Benchmark + OS Reference table ───────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 12 }}>

            {/* Benchmark */}
            <Panel title="Benchmark" sub="40s forced crash · measured results" accent={C.black}>
              <p style={{ fontFamily: C.sans, fontSize: 10, color: C.mid, lineHeight: 1.6, marginBottom: 12 }}>
                Forces crash mode for 40 seconds. All three algorithm queues run under identical sustained burst load.
                Results are real backend-measured timestamps — use these numbers in your viva.
              </p>
              <button onClick={runBenchmark} disabled={benchRunning} style={{
                width: "100%", padding: "9px 0",
                background: benchRunning ? C.subtle : C.black,
                color: benchRunning ? C.muted : "#fff",
                border: `1px solid ${benchRunning ? C.border : C.black}`,
                fontFamily: C.sans, fontSize: 11, fontWeight: 700,
                cursor: benchRunning ? "not-allowed" : "pointer",
                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
              }}>{benchRunning ? "Running… (40s)" : "▶ Run Benchmark"}</button>

              {benchRunning && (
                <div style={{ padding: "7px 10px", background: C.priBg, border: `1px solid ${C.pri}33`, fontFamily: C.mono, fontSize: 9, color: C.pri }}>
                  Forcing burst load · recording per-tick timestamps…
                </div>
              )}

              {benchResult && !benchResult.error && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  <div style={{ fontFamily: C.sans, fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                    {benchResult.session?.crash_ticks}/{benchResult.session?.total_ticks} crash ticks ({benchResult.session?.crash_percentage}%)
                  </div>
                  {[
                    ["FCFS avg wait",      `${benchResult.average_wait?.fcfs}s`,                       C.fcfs],
                    ["Priority avg wait",  `${benchResult.average_wait?.priority}s`,                   C.pri ],
                    ["Hybrid avg wait",    `${benchResult.average_wait?.hybrid}s`,                     C.hyb ],
                    ["Hybrid vs FCFS",     `${benchResult.hybrid_improvement?.vs_fcfs_pct}% faster`,   C.hyb ],
                    ["Hybrid vs Priority", `${benchResult.hybrid_improvement?.vs_priority_pct}% faster`, C.hyb],
                    ["P95 FCFS",           `${benchResult.p95_wait?.fcfs}s`,                           C.fcfs],
                    ["P95 Priority",       `${benchResult.p95_wait?.priority}s`,                       C.pri ],
                    ["P95 Hybrid",         `${benchResult.p95_wait?.hybrid}s`,                         C.hyb ],
                  ].map(([l, v, c], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 9px", background: i % 2 === 0 ? C.subtle : C.bg, border: `1px solid ${C.border}` }}>
                      <span style={{ fontFamily: C.sans, fontSize: 9, color: C.muted }}>{l}</span>
                      <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: c }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {benchResult?.error && (
                <div style={{ fontFamily: C.sans, fontSize: 9, color: C.fcfs, marginTop: 6 }}>{benchResult.error}</div>
              )}
            </Panel>

            {/* OS Reference table */}
            <Panel title="OS Concept Reference" sub="complete project objective mapping" accent={C.black} noPad>
              <div style={{ display: "grid", gridTemplateColumns: "170px 190px 150px 1fr", background: C.subtle, borderBottom: `1px solid ${C.borderMd}` }}>
                {["OS Concept", "Trading Analog", "Algorithm", "Evidence in Dashboard"].map(h => (
                  <div key={h} style={{ padding: "7px 12px", fontFamily: C.sans, fontSize: 8, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", borderRight: `1px solid ${C.border}` }}>{h}</div>
                ))}
              </div>
              {[
                ["CPU Ready Queue",       "Order queue (max 200/algo)",      "All",      "Queue Depth chart + KPI card",                    C.purple],
                ["FIFO / Non-preemptive", "FCFS dispatch · arrival order",   "FCFS",     "FCFS lane — oldest orders at row 1",              C.fcfs  ],
                ["Priority Scheduling",   "HFT > Institution > Retail",      "Priority", "Priority lane — P5 always dispatched first",      C.pri   ],
                ["MLFQ",                  "Priority + Aging hybrid",          "Hybrid",   "Hybrid lane — lowest avg + max wait",             C.hyb   ],
                ["Process Starvation",    "P1 Retail never dispatched",       "Priority", "STARV labels · max_wait grows unboundedly",       C.fcfs  ],
                ["Aging",                 "+0.8 pri/s after 1.5s wait",       "Hybrid",   "Yellow boost bars in Hybrid queue rows",          "#b45309"],
                ["Semaphore",             "4 slots/tick processing cap",       "All",      "Arrived vs processed in System Log",              C.mid   ],
                ["Burst Arrival",         "Crash: 14–22 orders/tick",         "All",      "Crash banner + queue spike + chart shading",      C.fcfs  ],
                ["Buffer Overflow",       "Rejected when queue = 200",        "All",      "Overflow counter · rejected in lane cumulative",  C.fcfs  ],
                ["Throughput",            "Orders processed per tick",         "All",      "Cumulative processed in each lane header",        C.hyb   ],
                ["Waiting Time",          "Arrival → dispatch timestamp delta","All",      "Lane wait_time · 3-line wait chart · KPI cards",  C.pri   ],
                ["Tail Latency (P95)",    "95th pct wait time",               "All",      "P95 in each lane sub-metric row",                 C.hyb   ],
                ["Starvation Fix",        "Hybrid bounded max_wait",          "Hybrid",   "Max-wait chart: Hybrid line stays flat vs others",C.hyb   ],
              ].map(([os, trade, algo, evidence, color], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "170px 190px 150px 1fr", background: i % 2 === 0 ? C.bg : C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ padding: "7px 12px", fontFamily: C.mono, fontSize: 9, fontWeight: 700, color, borderRight: `1px solid ${C.border}` }}>{os}</div>
                  <div style={{ padding: "7px 12px", fontFamily: C.sans, fontSize: 9, color: C.mid, borderRight: `1px solid ${C.border}` }}>{trade}</div>
                  <div style={{ padding: "7px 12px", fontFamily: C.sans, fontSize: 9, color: C.mid, borderRight: `1px solid ${C.border}` }}>{algo}</div>
                  <div style={{ padding: "7px 12px", fontFamily: C.sans, fontSize: 9, color: C.muted }}>{evidence}</div>
                </div>
              ))}
            </Panel>
          </div>

        </div>{/* end main content */}

        {/* ══ FOOTER ═══════════════════════════════════════════════════ */}
        <div style={{ borderTop: `2px solid ${C.black}`, padding: "10px 20px", background: C.nav, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: C.sans, fontSize: 10, color: "#555" }}>
            ORDERLY v3.1 · OS Scheduling PBL · FCFS vs Priority vs Hybrid (MLFQ) · {realData ? "NIFTY50 Historical Data" : "GBM Price Simulation"}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 9, color: "#333" }}>
            Cap: 4/tick · Buffer: 200/queue · Arrivals: 5/tick normal · Crash: 14–22/tick · Aging: +0.8/s after 1.5s
          </span>
        </div>

      </div>
    </>
  );
}