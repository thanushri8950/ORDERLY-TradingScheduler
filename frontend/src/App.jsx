import { useEffect, useState, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
  BarChart, Bar, Cell,
} from "recharts";

const C = {
  bg:"#ffffff", bgGray:"#f5f5f5", bgSection:"#fafafa", border:"#e0e0e0",
  borderDk:"#cccccc", text:"#1a1a1a", textMid:"#444444", textMuted:"#888888",
  red:"#d0021b", redBg:"#fff1f2", redLight:"#ffd6d9",
  green:"#007a3d", greenBg:"#f0faf5", greenLight:"#b8e8cf",
  amber:"#b45309", amberBg:"#fffbeb",
  purple:"#6d28d9", purpleBg:"#f5f3ff",
  black:"#000000", navBg:"#1a1a1a", tickerBg:"#111111",
  mono:"'Courier New', Courier, monospace",
  serif:"Georgia, 'Times New Roman', serif",
  sans:"'Helvetica Neue', Helvetica, Arial, sans-serif",
};

const Tick = ({ symbol, val, chg, up }) => (
  <div style={{ display:"flex", gap:10, alignItems:"center", padding:"0 14px", borderRight:`1px solid #333`, flexShrink:0 }}>
    <span style={{ fontFamily:C.sans, fontSize:10, color:"#aaa", letterSpacing:"0.05em" }}>{symbol}</span>
    <span style={{ fontFamily:C.mono, fontSize:12, color:"#fff", fontWeight:"bold" }}>{val}</span>
    <span style={{ fontFamily:C.mono, fontSize:11, color:up ? "#22c55e" : C.red, fontWeight:"bold" }}>
      {up ? "▲" : "▼"}{Math.abs(Number(chg)).toFixed(2)}
    </span>
  </div>
);

const MetricCard = ({ label, value, sub, color=C.text, bg=C.bg, accent }) => (
  <div style={{ background:bg, border:`1px solid ${C.border}`, borderTop:accent?`3px solid ${accent}`:undefined, padding:"14px 16px", minWidth:0 }}>
    <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>{label}</div>
    <div style={{ fontFamily:C.mono, fontSize:22, fontWeight:"bold", color, lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, marginTop:5 }}>{sub}</div>}
  </div>
);

const OsBadge = ({ label, desc, color }) => (
  <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", background:color+"18", border:`1px solid ${color}50`, borderRadius:2 }}>
    <div style={{ width:7, height:7, borderRadius:"50%", background:color, flexShrink:0 }} />
    <span style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</span>
    <span style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted }}>— {desc}</span>
  </div>
);

const SchedRow = ({ name, osName, osDesc, wait, best, color, borderTop }) => {
  const isBest = wait === best;
  const pct = Math.min(Number(wait) * 25, 100);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 130px 80px", alignItems:"center", borderTop:borderTop?`1px solid ${C.border}`:undefined, padding:"11px 16px", background:isBest?C.greenBg:C.bg }}>
      <div>
        <div style={{ fontFamily:C.sans, fontSize:13, fontWeight:"bold", color }}>{name}</div>
        <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted }}>{osName}</div>
      </div>
      <div style={{ paddingRight:16 }}>
        <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, marginBottom:5 }}>{osDesc}</div>
        <div style={{ height:5, background:C.bgGray, borderRadius:1 }}>
          <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:1, transition:"width 0.5s ease" }} />
        </div>
      </div>
      <div style={{ textAlign:"right", paddingRight:16 }}>
        <span style={{ fontFamily:C.mono, fontSize:16, fontWeight:"bold", color:isBest?C.green:C.textMid }}>{wait}s</span>
        {isBest && <div style={{ fontFamily:C.sans, fontSize:9, color:C.green, fontWeight:"bold", marginTop:2 }}>LOWEST WAIT ✓</div>}
      </div>
      <div style={{ textAlign:"center" }}>
        <span style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", padding:"3px 8px", borderRadius:2, background:isBest?C.greenBg:C.bgGray, color:isBest?C.green:C.textMuted, border:`1px solid ${isBest?C.greenLight:C.border}` }}>{isBest?"BEST":"—"}</span>
      </div>
    </div>
  );
};

const ChartTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.bg, border:`1px solid ${C.borderDk}`, padding:"8px 12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)" }}>
      {payload.map((p,i) => (
        <div key={i} style={{ fontFamily:C.mono, fontSize:11, color:p.color, marginBottom:2 }}>
          {String(p.name).toUpperCase()}: <span style={{ color:C.text }}>{Number(p.value).toFixed(3)}s</span>
        </div>
      ))}
    </div>
  );
};

const OrderRow = ({ o, type, i }) => (
  <div style={{ display:"grid", gridTemplateColumns:"44px 1fr 44px 32px 54px", alignItems:"center", padding:"5px 10px", background:i%2===0?C.bg:C.bgSection, borderBottom:`1px solid ${C.border}`, fontSize:11, fontFamily:C.mono }}>
    <span style={{ color:C.textMuted }}>#{o.order_id}</span>
    <div style={{ paddingRight:8 }}>
      <div style={{ height:4, background:C.bgGray }}>
        <div style={{ width:`${Math.min(o.quantity*2,100)}%`, height:"100%", background:type==="BUY"?C.green:C.red }} />
      </div>
    </div>
    <span style={{ color:C.textMid, textAlign:"right" }}>{o.quantity}</span>
    <span style={{ textAlign:"center", color:o.priority>=4?C.amber:C.textMuted, fontWeight:o.priority>=4?"bold":"normal" }}>P{o.priority}</span>
    <span style={{ textAlign:"center", fontSize:9, padding:"1px 4px", background:o.priority>=4?C.amberBg:C.bgGray, color:o.priority>=4?C.amber:C.textMuted, border:`1px solid ${o.priority>=4?"#fde68a":C.border}` }}>{o.priority>=4?"URGENT":"NORMAL"}</span>
  </div>
);

const axisProps = { fontFamily:C.mono, fontSize:9, fill:C.textMuted };

const SectionCard = ({ title, children }) => (
  <div style={{ border:`1px solid ${C.border}` }}>
    <div style={{ padding:"12px 16px", borderBottom:`2px solid ${C.black}` }}>
      <span style={{ fontFamily:C.serif, fontSize:18, fontWeight:"bold" }}>{title}</span>
    </div>
    <div style={{ padding:"16px" }}>{children}</div>
  </div>
);

// ── MARKETS TAB ──────────────────────────────────────────────────────────────
const MarketsTab = ({ price, prevPrice, priceHist, history, queue, isCrash, buyOrders, sellOrders, stats, order, log }) => {
  const priceUp = price >= prevPrice;
  const diff = Math.abs(price - prevPrice).toFixed(2);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
        <MetricCard label="Simulated Price" value={`₹${price.toFixed(2)}`} color={priceUp?C.green:C.red} sub={priceUp?`▲ +${diff}`:`▼ -${diff}`} accent={priceUp?C.green:C.red} />
        <MetricCard label="Queue Depth" value={queue} color={queue>30?C.red:C.green} sub={queue>30?"OVERLOADED":"Normal processing"} accent={queue>30?C.red:C.green} bg={queue>30?C.redBg:C.bg} />
        <MetricCard label="Hybrid Avg Wait" value={`${stats.hybrid}s`} color={C.green} sub="Best scheduler" accent={C.green} bg={C.greenBg} />
        <MetricCard label="FCFS Avg Wait" value={`${stats.fcfs}s`} color={C.red} sub="Worst under load" accent={C.red} />
        <MetricCard label="Market State" value={isCrash?"CRASH":"STABLE"} color={isCrash?C.red:C.green} sub={isCrash?"Burst: 20 orders/tick":"Normal: 2 orders/tick"} accent={isCrash?C.red:C.green} bg={isCrash?C.redBg:C.bg} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ border:`1px solid ${C.border}` }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold" }}>Price Movement</span>
            <span style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, background:C.bgGray, padding:"2px 8px", border:`1px solid ${C.border}` }}>SIMULATED</span>
          </div>
          <div style={{ padding:"8px 0 0" }}>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={priceHist} margin={{ top:4, right:12, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={priceUp?C.green:C.red} stopOpacity={0.15}/>
                    <stop offset="100%" stopColor={priceUp?C.green:C.red} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide /><YAxis tick={axisProps} width={46} tickFormatter={v=>`₹${v.toFixed(0)}`}/>
                <Tooltip contentStyle={{ background:C.bg, border:`1px solid ${C.borderDk}`, fontSize:11, fontFamily:C.mono }} formatter={v=>[`₹${Number(v).toFixed(2)}`,"price"]}/>
                <Area type="monotone" dataKey="price" stroke={priceUp?C.green:C.red} strokeWidth={1.5} fill="url(#pg)" dot={false} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ border:`1px solid ${C.border}` }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold" }}>Order Book</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"44px 1fr 44px 32px 54px", padding:"4px 10px", background:C.bgSection, borderBottom:`1px solid ${C.border}` }}>
            {["ID","QTY","","PRI","TYPE"].map((h,i)=>(
              <span key={i} style={{ fontFamily:C.sans, fontSize:9, color:C.textMuted, textTransform:"uppercase" }}>{h}</span>
            ))}
          </div>
          <div style={{ borderBottom:`2px solid ${C.green}` }}>
            <div style={{ padding:"3px 10px", background:C.greenBg }}><span style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color:C.green }}>▲ BUY {buyOrders.length}</span></div>
            <div style={{ maxHeight:100, overflowY:"auto" }}>
              {buyOrders.length===0?<div style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted, textAlign:"center", padding:"8px 0" }}>No orders</div>
                :buyOrders.map((o,i)=><OrderRow key={i} o={o} type="BUY" i={i}/>)}
            </div>
          </div>
          <div>
            <div style={{ padding:"3px 10px", background:C.redBg }}><span style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color:C.red }}>▼ SELL {sellOrders.length}</span></div>
            <div style={{ maxHeight:100, overflowY:"auto" }}>
              {sellOrders.length===0?<div style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted, textAlign:"center", padding:"8px 0" }}>No orders</div>
                :sellOrders.map((o,i)=><OrderRow key={i} o={o} type="SELL" i={i}/>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SCHEDULERS TAB ───────────────────────────────────────────────────────────
const SchedulersTab = ({ history, stats }) => {
  const best = Math.min(Number(stats.fcfs)||Infinity, Number(stats.priority)||Infinity, Number(stats.hybrid)||Infinity);
  const barData = [
    { name:"FCFS", wait:Number(stats.fcfs), fill:C.red },
    { name:"Priority", wait:Number(stats.priority), fill:C.amber },
    { name:"Hybrid", wait:Number(stats.hybrid), fill:C.green },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* OS explanation cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
        {[
          { name:"FCFS", full:"First-Come, First-Served", color:C.red, bg:C.redBg,
            problem:"Under burst load, a flood of low-priority orders blocks urgent institutional orders. No awareness of order importance — pure arrival order.",
            osLink:"Equivalent to non-preemptive scheduling: CPU processes jobs in queue order regardless of burst time or priority.",
            verdict:"Fails under load" },
          { name:"Priority", full:"Priority-Based Scheduling", color:C.amber, bg:C.amberBg,
            problem:"High-priority orders execute first, but low-priority orders may wait indefinitely (starvation). Works well in short bursts but unfair over time.",
            osLink:"Equivalent to preemptive priority scheduling: higher priority jobs preempt lower ones, but starvation is a known OS problem.",
            verdict:"Risk of starvation" },
          { name:"Hybrid", full:"Priority + Aging", color:C.green, bg:C.greenBg,
            problem:"Combines priority scheduling with aging — orders waiting too long get their priority bumped up. Prevents starvation while still serving urgent orders first.",
            osLink:"Equivalent to multi-level feedback queue (MLFQ): the OS solution to balancing responsiveness and fairness under heavy load.",
            verdict:"Best — solves both" },
        ].map(s => (
          <div key={s.name} style={{ border:`1px solid ${s.color}40`, borderTop:`3px solid ${s.color}`, background:s.bg, padding:16 }}>
            <div style={{ fontFamily:C.sans, fontSize:14, fontWeight:"bold", color:s.color, marginBottom:2 }}>{s.name}</div>
            <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, marginBottom:10 }}>{s.full}</div>
            <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, marginBottom:10, lineHeight:1.5 }}>{s.problem}</div>
            <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, borderTop:`1px solid ${s.color}30`, paddingTop:8, lineHeight:1.5 }}>
              <span style={{ fontWeight:"bold", color:s.color }}>OS Analog: </span>{s.osLink}
            </div>
            <div style={{ marginTop:8, padding:"4px 8px", background:s.color+"20", border:`1px solid ${s.color}40`, display:"inline-block" }}>
              <span style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color:s.color }}>{s.verdict}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Scheduler table */}
      <div style={{ border:`1px solid ${C.border}` }}>
        <div style={{ padding:"12px 16px", borderBottom:`2px solid ${C.black}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:C.serif, fontSize:18, fontWeight:"bold" }}>Live Performance Comparison</span>
          <span style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted }}>Rolling average wait time · lower = better</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 130px 80px", padding:"6px 16px", background:C.bgSection, borderBottom:`1px solid ${C.borderDk}` }}>
          {["Scheduler","Behavior & Wait Indicator","Avg Wait Time","Status"].map((h,i)=>(
            <div key={i} style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.07em", textAlign:i>=2?"center":"left" }}>{h}</div>
          ))}
        </div>
        <SchedRow name="FCFS" osName="Non-Preemptive" osDesc="Arrival order only — no urgency. High-priority orders wait behind low-priority ones during crash." wait={stats.fcfs} best={best} color={C.red} borderTop={false} />
        <SchedRow name="Priority" osName="Priority-Based" osDesc="Priority first, but starvation risk. Low-priority orders may never execute under sustained load." wait={stats.priority} best={best} color={C.amber} borderTop />
        <SchedRow name="Hybrid" osName="Priority + Aging (MLFQ)" osDesc="Priority + aging prevents starvation. Every order eventually executes. Lowest average wait time." wait={stats.hybrid} best={best} color={C.green} borderTop />
      </div>

      {/* Charts side by side */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <div style={{ border:`1px solid ${C.border}` }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold" }}>Wait Time Over Time</span>
          </div>
          <div style={{ padding:"8px 0 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top:4, right:12, bottom:0, left:0 }}>
                <XAxis dataKey="t" hide /><YAxis tick={axisProps} width={46} tickFormatter={v=>`${v.toFixed(1)}s`}/>
                <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{ fontFamily:C.sans, fontSize:10 }} formatter={v=>v.toUpperCase()}/>
                <Line type="monotone" dataKey="fcfs" stroke={C.red} strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                <Line type="monotone" dataKey="priority" stroke={C.amber} strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                <Line type="monotone" dataKey="hybrid" stroke={C.green} strokeWidth={2} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ border:`1px solid ${C.border}` }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold" }}>Average Wait Comparison</span>
          </div>
          <div style={{ padding:"8px 0 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top:4, right:12, bottom:0, left:0 }}>
                <XAxis dataKey="name" tick={axisProps}/><YAxis tick={axisProps} width={40} tickFormatter={v=>`${v.toFixed(1)}s`}/>
                <Tooltip contentStyle={{ background:C.bg, border:`1px solid ${C.borderDk}`, fontSize:11, fontFamily:C.mono }} formatter={v=>[`${Number(v).toFixed(3)}s`,"avg wait"]}/>
                <Bar dataKey="wait" isAnimationActive={false}>
                  {barData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── QUEUE ANALYSIS TAB ───────────────────────────────────────────────────────
const QueueTab = ({ history, queue, isCrash }) => {
  const crashes = history.filter(h=>h.queue>30).length;
  const stable  = history.length - crashes;
  const maxQ    = history.length ? Math.max(...history.map(h=>h.queue)) : 0;
  const avgQ    = history.length ? (history.reduce((s,h)=>s+h.queue,0)/history.length).toFixed(1) : 0;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <MetricCard label="Current Queue" value={queue} color={queue>30?C.red:C.green} sub={queue>30?"Above stress threshold":"Below threshold"} accent={queue>30?C.red:C.green} bg={queue>30?C.redBg:C.bg}/>
        <MetricCard label="Peak Queue" value={maxQ} color={maxQ>30?C.red:C.green} sub="Highest recorded depth" accent={maxQ>30?C.red:C.green}/>
        <MetricCard label="Average Queue" value={avgQ} color={C.textMid} sub="Rolling session average" accent={C.amber}/>
        <MetricCard label="Crash Ticks" value={crashes} color={C.red} sub={`${stable} stable ticks`} accent={C.red} bg={crashes>0?C.redBg:C.bg}/>
      </div>

      {/* Explanation of what queue represents */}
      <div style={{ background:C.bgSection, border:`1px solid ${C.border}`, borderLeft:`4px solid ${C.purple}`, padding:"14px 16px" }}>
        <div style={{ fontFamily:C.sans, fontSize:12, fontWeight:"bold", color:C.purple, marginBottom:6 }}>How This Maps to OS Concepts</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div>
            <div style={{ fontFamily:C.sans, fontSize:11, fontWeight:"bold", color:C.text, marginBottom:4 }}>In This Simulation</div>
            <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.6 }}>
              The order queue holds unprocessed BUY/SELL orders. Each tick, max 3 orders are processed (the <strong>processing cap</strong>). 
              During crash mode, 20 orders arrive per tick — 17 more than capacity. The queue grows until the crash ends.
            </div>
          </div>
          <div>
            <div style={{ fontFamily:C.sans, fontSize:11, fontWeight:"bold", color:C.text, marginBottom:4 }}>OS Equivalent</div>
            <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.6 }}>
              This is identical to a <strong>CPU ready queue</strong> under burst process arrival. The processing cap = CPU time quantum × cores. 
              Queue overflow = system thrashing. The stress threshold (30) represents the point of observable latency degradation.
            </div>
          </div>
        </div>
      </div>

      <div style={{ border:`1px solid ${C.border}` }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold" }}>Queue Depth Over Time — OS Ready Queue Simulation</span>
          <span style={{ fontFamily:C.sans, fontSize:10, color:C.red, background:C.redBg, padding:"2px 8px", border:`1px solid ${C.red}` }}>Threshold @ 30 = stress</span>
        </div>
        <div style={{ padding:"8px 0 0" }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history} margin={{ top:4, right:12, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="qg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.red} stopOpacity={0.2}/>
                  <stop offset="100%" stopColor={C.red} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide/>
              <YAxis tick={axisProps} width={30}/>
              <ReferenceLine y={30} stroke={C.red} strokeDasharray="4 3" label={{ value:"stress threshold", fill:C.red, fontSize:9, fontFamily:C.mono, position:"insideTopRight" }}/>
              <Tooltip contentStyle={{ background:C.bg, border:`1px solid ${C.borderDk}`, fontSize:11, fontFamily:C.mono }} formatter={v=>[v,"queue depth"]}/>
              <Area type="monotone" dataKey="queue" stroke={C.red} strokeWidth={1.5} fill="url(#qg)" dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Crash vs normal breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ border:`1px solid ${C.border}`, padding:16 }}>
          <div style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold", marginBottom:12, paddingBottom:8, borderBottom:`2px solid ${C.black}` }}>Normal Operation (2 orders/tick)</div>
          <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.7 }}>
            <div>• 2 orders arrive per tick</div>
            <div>• 3 orders processed per tick</div>
            <div>• Queue shrinks or stays stable</div>
            <div>• All schedulers perform similarly</div>
            <div style={{ marginTop:8, color:C.green, fontWeight:"bold" }}>→ No scheduling advantage visible</div>
          </div>
        </div>
        <div style={{ border:`1px solid ${C.red}`, background:C.redBg, padding:16 }}>
          <div style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold", marginBottom:12, paddingBottom:8, borderBottom:`2px solid ${C.red}`, color:C.red }}>Crash Mode — Burst Load (20 orders/tick)</div>
          <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.7 }}>
            <div>• 20 orders arrive per tick</div>
            <div>• Still only 3 processed per tick</div>
            <div>• Queue grows +17 per tick</div>
            <div>• FCFS wait time spikes (no priority)</div>
            <div style={{ marginTop:8, color:C.red, fontWeight:"bold" }}>→ Hybrid advantage becomes clearly visible</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── OS CONCEPTS TAB ──────────────────────────────────────────────────────────
const OsConceptsTab = () => (
  <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
    {/* Problem statement card */}
    <div style={{ background:C.bgSection, border:`1px solid ${C.border}`, borderTop:`3px solid ${C.black}`, padding:"18px 20px" }}>
      <div style={{ fontFamily:C.serif, fontSize:18, fontWeight:"bold", marginBottom:12 }}>Problem Statement — What This Project Solves</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div>
          <div style={{ fontFamily:C.sans, fontSize:11, fontWeight:"bold", color:C.red, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>The Problem</div>
          {[
            ["Burst order arrival","Stock market volatility generates sudden spikes of BUY/SELL orders simultaneously — far exceeding normal processing capacity"],
            ["FCFS inefficiency","Traditional arrival-order processing treats a small retail order the same as an urgent institutional order — causing critical delays"],
            ["Priority order starvation","High-priority orders get delayed behind a backlog of low-priority ones during load spikes"],
            ["System instability","Queue overflow leads to mounting wait times, degraded response, and potential execution failures"],
          ].map(([title,desc],i)=>(
            <div key={i} style={{ display:"flex", gap:10, marginBottom:10 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.red, flexShrink:0, marginTop:5 }}/>
              <div>
                <div style={{ fontFamily:C.sans, fontSize:11, fontWeight:"bold", color:C.text }}>{title}</div>
                <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily:C.sans, fontSize:11, fontWeight:"bold", color:C.green, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>This Project's Solution</div>
          {[
            ["Simulated burst injection","20% probability crash mode injects 20×  normal order volume, reproducibly triggering queue overflow — demonstrating the exact overload scenario"],
            ["Three scheduler comparison","FCFS, Priority, and Hybrid run simultaneously on the same queue — wait times measured and compared live, making scheduler impact visually obvious"],
            ["Hybrid with aging","The Hybrid scheduler implements priority + aging: orders that wait too long get promoted, preventing starvation while still serving urgent orders first"],
            ["Real-time metrics","Rolling average wait time and queue depth chart make the OS scheduling theory directly observable as market data"],
          ].map(([title,desc],i)=>(
            <div key={i} style={{ display:"flex", gap:10, marginBottom:10 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, flexShrink:0, marginTop:5 }}/>
              <div>
                <div style={{ fontFamily:C.sans, fontSize:11, fontWeight:"bold", color:C.text }}>{title}</div>
                <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* OS mapping table */}
    <SectionCard title="OS Concept → Trading Domain Mapping">
      <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:C.sans, fontSize:11 }}>
        <thead>
          <tr style={{ background:C.bgGray, borderBottom:`2px solid ${C.black}` }}>
            {["OS Concept","Trading Equivalent","Where You See It"].map(h=>(
              <th key={h} style={{ textAlign:"left", padding:"8px 12px", fontWeight:"bold", fontSize:10, textTransform:"uppercase", letterSpacing:"0.07em", color:C.textMuted }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["CPU Ready Queue","Order Queue","Queue Depth panel — grows during crash"],
            ["Process Arrival Rate","Orders/tick","2 normal, 20 during crash mode"],
            ["CPU Processing Capacity","Processing cap (3/tick)","Fixed throughput regardless of load"],
            ["FCFS Scheduling","Arrival-order execution","FCFS line in wait time chart — spikes during crash"],
            ["Priority Scheduling","Institutional > Retail priority","Priority line — faster than FCFS, starvation risk"],
            ["Multi-Level Feedback Queue","Hybrid scheduler","Hybrid line — lowest wait, no starvation"],
            ["Process Starvation","Low-priority order never executing","Visible in Priority scheduler under sustained crash"],
            ["Aging / Priority Boost","Hybrid wait-time promotion","Hybrid prevents runaway wait times"],
            ["System Thrash / Overload","Queue overflow > 30","Red stress threshold line on queue chart"],
            ["Burst Process Arrival","Market crash simulation","20% tick probability, visible in crash banner"],
          ].map(([os,trade,where],i)=>(
            <tr key={i} style={{ background:i%2===0?C.bg:C.bgSection, borderBottom:`1px solid ${C.border}` }}>
              <td style={{ padding:"8px 12px", fontWeight:"bold", color:C.purple, fontFamily:C.mono, fontSize:11 }}>{os}</td>
              <td style={{ padding:"8px 12px", color:C.text }}>{trade}</td>
              <td style={{ padding:"8px 12px", color:C.textMuted }}>{where}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>

    {/* What makes it unique */}
    <SectionCard title="What Makes This Project Unique">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
        {[
          { color:C.green, title:"Domain-Grounded OS Demo", desc:"Most OS scheduling demos use abstract job arrays. This maps every OS concept to a real financial trading domain — queue overflow = market crash, processing cap = CPU throughput, aging = fairness under sustained load. The analogy is not decorative; it is structurally accurate." },
          { color:C.amber, title:"Controllable Crash Simulation", desc:"Real trading systems cannot demonstrate scheduling failure on demand. This project injects a reproducible burst load (crash mode) that reliably triggers queue overflow and exposes the difference between FCFS, Priority, and Hybrid — making the OS theory observable in real time." },
          { color:C.purple, title:"Three-Way Live Comparison", desc:"All three schedulers run simultaneously on the same live queue. Wait times are measured and charted in real time. The performance gap between FCFS and Hybrid is not theoretical — it is calculated from actual order timestamps and visualized as diverging chart lines." },
        ].map((u,i)=>(
          <div key={i} style={{ borderTop:`3px solid ${u.color}`, padding:"14px 0 0" }}>
            <div style={{ fontFamily:C.sans, fontSize:12, fontWeight:"bold", color:u.color, marginBottom:8 }}>{u.title}</div>
            <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.6 }}>{u.desc}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  </div>
);

// ── PERFORMANCE TAB ──────────────────────────────────────────────────────────
const PerformanceTab = ({ stats, history, log, benchmarkResult, benchmarkRunning, runBenchmark, starvationMode, toggleStarvation, userTypeCounts }) => {
  const best = Math.min(Number(stats.fcfs)||Infinity, Number(stats.priority)||Infinity, Number(stats.hybrid)||Infinity);
  const imp_fcfs = stats.fcfs !== "0.000" ? (((Number(stats.fcfs) - Number(stats.hybrid)) / Number(stats.fcfs)) * 100).toFixed(1) : "0.0";
  const imp_prio = stats.priority !== "0.000" ? (((Number(stats.priority) - Number(stats.hybrid)) / Number(stats.priority)) * 100).toFixed(1) : "0.0";
  const totalOrders = Object.values(userTypeCounts).reduce((a,b)=>a+b, 0) || 1;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        <MetricCard label="Hybrid vs FCFS Improvement" value={`${imp_fcfs}%`} color={C.green} sub="Measured from real timestamps" accent={C.green} bg={C.greenBg}/>
        <MetricCard label="Hybrid vs Priority Improvement" value={`${imp_prio}%`} color={C.green} sub="Measured from real timestamps" accent={C.green} bg={C.greenBg}/>
        <MetricCard label="Best Avg Wait Time" value={`${stats.hybrid}s`} color={C.green} sub="Hybrid — current session rolling avg" accent={C.green} bg={C.greenBg}/>
      </div>

      {/* ── BENCHMARK BUTTON ── */}
      <div style={{ border:`1px solid ${C.border}`, borderTop:`3px solid ${C.amber}` }}>
        <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontFamily:C.serif, fontSize:16, fontWeight:"bold", marginBottom:3 }}>Run Benchmark</div>
            <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted }}>
              Forces 35 seconds of crash mode, then fetches real measured stats from the backend. Use this during demo to generate proof numbers on demand.
            </div>
          </div>
          <button
            onClick={runBenchmark}
            disabled={benchmarkRunning}
            style={{
              background: benchmarkRunning ? C.bgGray : C.black,
              color: benchmarkRunning ? C.textMuted : "#fff",
              border: `1px solid ${benchmarkRunning ? C.border : C.black}`,
              fontFamily: C.sans, fontSize: 12, fontWeight: "bold",
              padding: "10px 24px", cursor: benchmarkRunning ? "not-allowed" : "pointer",
              letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            {benchmarkRunning ? "Running… (35s)" : "▶ Run Benchmark"}
          </button>
        </div>

        {benchmarkRunning && (
          <div style={{ padding:"12px 16px", background:C.amberBg, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:C.amber, animation:"blink 0.8s infinite" }}/>
            <span style={{ fontFamily:C.sans, fontSize:11, color:C.amber, fontWeight:"bold" }}>
              Forcing crash mode — collecting wait time data across all three schedulers…
            </span>
          </div>
        )}

        {benchmarkResult && !benchmarkResult.error && (
          <div style={{ padding:"16px" }}>
            <div style={{ fontFamily:C.sans, fontSize:11, fontWeight:"bold", color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
              Benchmark Results — {benchmarkResult.session?.total_ticks} ticks · {benchmarkResult.session?.crash_ticks} crash events ({benchmarkResult.session?.crash_percentage}%)
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
              {[
                { label:"FCFS Avg Wait",     val:`${benchmarkResult.average_wait_time?.fcfs}s`,     color:C.red   },
                { label:"Priority Avg Wait", val:`${benchmarkResult.average_wait_time?.priority}s`, color:C.amber },
                { label:"Hybrid Avg Wait",   val:`${benchmarkResult.average_wait_time?.hybrid}s`,   color:C.green },
              ].map((m,i) => (
                <div key={i} style={{ background:C.bgSection, border:`1px solid ${C.border}`, padding:"10px 14px" }}>
                  <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, textTransform:"uppercase", marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontFamily:C.mono, fontSize:18, fontWeight:"bold", color:m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ background:C.greenBg, border:`1px solid ${C.greenLight}`, padding:"10px 14px" }}>
                <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, textTransform:"uppercase", marginBottom:4 }}>Hybrid improvement vs FCFS</div>
                <div style={{ fontFamily:C.mono, fontSize:20, fontWeight:"bold", color:C.green }}>{benchmarkResult.hybrid_improvement?.vs_fcfs_pct}%</div>
                <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, marginTop:3 }}>lower average wait time</div>
              </div>
              <div style={{ background:C.greenBg, border:`1px solid ${C.greenLight}`, padding:"10px 14px" }}>
                <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, textTransform:"uppercase", marginBottom:4 }}>P95 Wait — FCFS vs Hybrid</div>
                <div style={{ fontFamily:C.mono, fontSize:20, fontWeight:"bold", color:C.text }}>
                  <span style={{ color:C.red }}>{benchmarkResult.p95_wait_time?.fcfs}s</span>
                  <span style={{ color:C.textMuted, fontSize:14 }}> → </span>
                  <span style={{ color:C.green }}>{benchmarkResult.p95_wait_time?.hybrid}s</span>
                </div>
                <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, marginTop:3 }}>95th percentile latency reduction</div>
              </div>
            </div>
          </div>
        )}
        {benchmarkResult?.error && (
          <div style={{ padding:"12px 16px", background:C.redBg }}>
            <span style={{ fontFamily:C.sans, fontSize:11, color:C.red }}>{benchmarkResult.error}</span>
          </div>
        )}
      </div>

      {/* ── STARVATION DEMO ── */}
      <div style={{ border:`1px solid ${starvationMode ? C.red : C.border}`, borderTop:`3px solid ${starvationMode ? C.red : C.purple}` }}>
        <div style={{ padding:"14px 16px", borderBottom:`1px solid ${starvationMode ? C.red : C.border}`, background:starvationMode ? C.redBg : C.bg, display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:20 }}>
          <div>
            <div style={{ fontFamily:C.serif, fontSize:16, fontWeight:"bold", marginBottom:3, color:starvationMode ? C.red : C.text }}>
              Starvation Demo {starvationMode ? "— ACTIVE" : ""}
            </div>
            <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted, lineHeight:1.6, maxWidth:540 }}>
              {starvationMode
                ? "Pure Priority mode is ON — aging disabled. Watch low-priority (P1/P2) Retail orders accumulate in the queue and never get dispatched while P5 HFT orders keep arriving. This is starvation. Switch back to see Hybrid's aging fix it."
                : "Enable pure Priority mode (no aging). Low-priority orders will starve — they never execute because high-priority orders keep arriving. This proves why Hybrid (Priority + Aging) is necessary. OS analog: a process stuck in the ready queue indefinitely."}
            </div>
          </div>
          <button
            onClick={toggleStarvation}
            style={{
              background: starvationMode ? C.red : C.bg,
              color: starvationMode ? "#fff" : C.text,
              border: `2px solid ${starvationMode ? C.red : C.borderDk}`,
              fontFamily: C.sans, fontSize: 11, fontWeight: "bold",
              padding: "8px 18px", cursor: "pointer",
              letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0,
            }}
          >
            {starvationMode ? "■ Disable (Restore Hybrid)" : "▶ Enable Starvation Demo"}
          </button>
        </div>
        {starvationMode && (
          <div style={{ padding:"12px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ background:C.redBg, border:`1px solid ${C.red}`, padding:"10px 14px" }}>
              <div style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color:C.red, marginBottom:6, textTransform:"uppercase" }}>What you should see (Priority only)</div>
              <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.6 }}>
                P1/P2 Retail orders pile up in the queue. P5 HFT orders get dispatched every tick. Wait time for FCFS climbs — but Priority wait stays low only because it keeps picking the same high-priority orders.
              </div>
            </div>
            <div style={{ background:C.greenBg, border:`1px solid ${C.greenLight}`, padding:"10px 14px" }}>
              <div style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color:C.green, marginBottom:6, textTransform:"uppercase" }}>Disable to restore Hybrid behavior</div>
              <div style={{ fontFamily:C.sans, fontSize:11, color:C.textMid, lineHeight:1.6 }}>
                Hybrid aging kicks in — orders waiting {">"}2s get priority-boosted. Low-priority orders eventually get dispatched. Queue stabilizes. This is the OS solution to starvation.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── USER TYPE BREAKDOWN ── */}
      <div style={{ border:`1px solid ${C.border}` }}>
        <div style={{ padding:"12px 16px", borderBottom:`2px solid ${C.black}` }}>
          <span style={{ fontFamily:C.serif, fontSize:18, fontWeight:"bold" }}>Order Source Breakdown</span>
          <span style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted, marginLeft:12 }}>Who is generating orders — this drives the priority distribution</span>
        </div>
        <div style={{ padding:"16px", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {[
            { type:"Retail",      color:C.amber,  priority:"P1–P2", desc:"Individual investors. Lowest urgency. Most at risk of starvation under pure priority.",  bg:C.amberBg },
            { type:"Institution", color:C.purple, priority:"P3–P4", desc:"Hedge funds, banks. Medium-high priority. Auto-escalate to P5 during crash mode.",       bg:C.purpleBg },
            { type:"HFT",         color:C.red,    priority:"P5",    desc:"High-Frequency Trading bots. Highest priority always. Will dominate pure priority queue.", bg:C.redBg },
          ].map(({ type, color, priority, desc, bg }) => {
            const count = userTypeCounts[type] || 0;
            const pct = Math.round((count / totalOrders) * 100);
            return (
              <div key={type} style={{ background:bg, border:`1px solid ${color}40`, borderTop:`3px solid ${color}`, padding:"14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                  <div style={{ fontFamily:C.sans, fontSize:13, fontWeight:"bold", color }}>{type}</div>
                  <div style={{ fontFamily:C.mono, fontSize:11, color:C.textMuted }}>{priority}</div>
                </div>
                <div style={{ fontFamily:C.mono, fontSize:22, fontWeight:"bold", color, marginBottom:6 }}>{count}</div>
                <div style={{ height:5, background:"rgba(0,0,0,0.08)", marginBottom:8 }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:color, transition:"width 0.5s ease" }}/>
                </div>
                <div style={{ fontFamily:C.sans, fontSize:10, color:C.textMuted, lineHeight:1.5 }}>{desc}</div>
                <div style={{ fontFamily:C.mono, fontSize:10, color, marginTop:6 }}>{pct}% of observed orders</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduler comparison table */}
      <div style={{ border:`1px solid ${C.border}` }}>
        <div style={{ padding:"12px 16px", borderBottom:`2px solid ${C.black}` }}>
          <span style={{ fontFamily:C.serif, fontSize:18, fontWeight:"bold" }}>Session Performance Summary</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 130px 80px", padding:"6px 16px", background:C.bgSection, borderBottom:`1px solid ${C.borderDk}` }}>
          {["Scheduler","Behavior & Wait Indicator","Avg Wait Time","Status"].map((h,i)=>(
            <div key={i} style={{ fontFamily:C.sans, fontSize:10, fontWeight:"bold", color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.07em", textAlign:i>=2?"center":"left" }}>{h}</div>
          ))}
        </div>
        <SchedRow name="FCFS"     osName="Non-Preemptive"   osDesc="Arrival order. No urgency. High-priority orders wait behind backlog under burst load." wait={stats.fcfs}     best={best} color={C.red}   borderTop={false}/>
        <SchedRow name="Priority" osName="Priority-Based"   osDesc="Priority-ordered. Starvation risk for Retail/low-priority orders under sustained load."  wait={stats.priority} best={best} color={C.amber} borderTop/>
        <SchedRow name="Hybrid"   osName="Priority + Aging" osDesc="Aging boosts long-waiting orders. No starvation. Lowest average wait time consistently." wait={stats.hybrid}   best={best} color={C.green} borderTop/>
      </div>

      {/* Chart + log */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <div style={{ border:`1px solid ${C.border}` }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold" }}>All Schedulers — Wait Time History</span>
          </div>
          <div style={{ padding:"8px 0 0" }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top:4, right:12, bottom:0, left:0 }}>
                <XAxis dataKey="t" hide/><YAxis tick={axisProps} width={46} tickFormatter={v=>`${v.toFixed(1)}s`}/>
                <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{ fontFamily:C.sans, fontSize:10 }} formatter={v=>v.toUpperCase()}/>
                <Line type="monotone" dataKey="fcfs"     stroke={C.red}   strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                <Line type="monotone" dataKey="priority" stroke={C.amber} strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                <Line type="monotone" dataKey="hybrid"   stroke={C.green} strokeWidth={2}   dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ border:`1px solid ${C.border}`, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"10px 12px", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontFamily:C.serif, fontSize:15, fontWeight:"bold" }}>System Log</span>
          </div>
          <div style={{ flex:1, overflowY:"auto", maxHeight:220 }}>
            {log.length===0
              ?<div style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted, textAlign:"center", padding:"20px 0" }}>Awaiting events…</div>
              :log.map((e,i)=>(
                <div key={i} style={{ padding:"6px 12px", borderBottom:`1px solid ${C.border}`, background:e.crash?C.redBg:C.bg }}>
                  <div style={{ fontFamily:C.mono, fontSize:9, color:C.textMuted, marginBottom:2 }}>{e.ts}</div>
                  <div style={{ fontFamily:C.sans, fontSize:11, color:e.crash?C.red:C.textMid, lineHeight:1.4 }}>{e.msg}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};

// ── ROOT APP ─────────────────────────────────────────────────────────────────
const TABS = ["Markets","Schedulers","Queue Analysis","OS Concepts","Performance"];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [price, setPrice]         = useState(100);
  const [prevPrice, setPrev]      = useState(100);
  const [queue, setQueue]         = useState(0);
  const [isCrash, setIsCrash]     = useState(false);
  const [connected, setConn]      = useState(false);
  const [tick, setTick]           = useState(0);
  const [order, setOrder]         = useState(null);
  const [buyOrders, setBuy]       = useState([]);
  const [sellOrders, setSell]     = useState([]);
  const [history, setHistory]     = useState([]);
  const [priceHist, setPH]        = useState([]);
  const [stats, setStats]         = useState({ fcfs:"0.000", priority:"0.000", hybrid:"0.000" });
  const [log, setLog]             = useState([]);
  const [benchmarkResult, setBenchmark] = useState(null);
  const [benchmarkRunning, setBenchRunning] = useState(false);
  const [starvationMode, setStarvationMode] = useState(false); // pure priority, no aging
  const [userTypeCounts, setUserTypeCounts] = useState({ Retail:0, Institution:0, HFT:0 });
  const tickRef = useRef(0);
  const starvationRef = useRef(false);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");
    ws.onopen  = () => setConn(true);
    ws.onclose = () => setConn(false);
    ws.onerror = () => setConn(false);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      tickRef.current += 1;
      const t = tickRef.current;
      setTick(t);
      setPrice(prev => { setPrev(prev); return d.price; });
      setIsCrash(!!d.crash);
      setOrder(d.hybrid);
      setQueue(d.queue_length);
      setBuy(d.buy_orders || []);
      setSell(d.sell_orders || []);
      // Track user type counts from order book
      const allOrders = [...(d.buy_orders||[]), ...(d.sell_orders||[])];
      setUserTypeCounts(prev => {
        const next = { ...prev };
        allOrders.forEach(o => { if (o.user_type && next[o.user_type] !== undefined) next[o.user_type]++; });
        return next;
      });
      setStats(prev => ({
        fcfs:     ((Number(prev.fcfs)     + Number(d.fcfs?.wait_time     || 0)) / 2).toFixed(3),
        priority: ((Number(prev.priority) + Number(d.priority?.wait_time || 0)) / 2).toFixed(3),
        hybrid:   ((Number(prev.hybrid)   + Number(d.hybrid?.wait_time   || 0)) / 2).toFixed(3),
      }));
      setHistory(h => [...h.slice(-80), { t, fcfs:d.fcfs?.wait_time||0, priority:d.priority?.wait_time||0, hybrid:d.hybrid?.wait_time||0, queue:d.queue_length }]);
      setPH(h => [...h.slice(-80), { t, price:d.price }]);
      const ts = new Date().toLocaleTimeString("en-IN", { hour12:false });
      if (d.crash) setLog(l => [{ ts, msg:`BURST LOAD — ${d.queue_length} orders queued · cap: 3/tick · Hybrid engaged`, crash:true }, ...l.slice(0,7)]);
      else if (t % 5 === 0) setLog(l => [{ ts, msg:`Hybrid dispatched ord#${d.hybrid?.order_id} · wait=${d.hybrid?.wait_time?.toFixed(2)}s`, crash:false }, ...l.slice(0,7)]);
    };
    return () => ws.close();
  }, []);

  const priceUp = price >= prevPrice;
  const diff = Math.abs(price - prevPrice).toFixed(2);

  const runBenchmark = async () => {
    setBenchRunning(true);
    setBenchmark(null);
    try { await fetch("http://127.0.0.1:8000/benchmark/start"); } catch(e) {}
    await new Promise(r => setTimeout(r, 35000));
    try {
      const res = await fetch("http://127.0.0.1:8000/stats");
      setBenchmark(await res.json());
    } catch(e) {
      setBenchmark({ error: "Could not fetch /stats — is backend running?" });
    }
    setBenchRunning(false);
  };

  const toggleStarvation = () => {
    const next = !starvationMode;
    setStarvationMode(next);
    fetch(`http://127.0.0.1:8000/mode/${next ? "priority_only" : "normal"}`).catch(()=>{});
  };

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{transform:translateY(-5px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing:border-box; margin:0; padding:0; }
        html, body { background:${C.bg}; color:${C.text}; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:${C.bgGray}; }
        ::-webkit-scrollbar-thumb { background:${C.borderDk}; }
      `}</style>

      <div style={{ background:C.bg, minHeight:"100vh" }}>
        {/* Ticker */}
        <div style={{ background:C.tickerBg, height:32, display:"flex", alignItems:"center", overflowX:"auto" }}>
          <div style={{ padding:"0 12px", borderRight:"1px solid #333", flexShrink:0 }}>
            <span style={{ fontFamily:C.sans, fontSize:10, color:"#f5a623", letterSpacing:"0.12em", fontWeight:"bold" }}>ORDERLY</span>
          </div>
          <Tick symbol="LAST"     val={price.toFixed(2)}     chg={price-prevPrice}         up={priceUp}/>
          <Tick symbol="QUEUE"    val={queue}                 chg={queue-30}                up={queue<=30}/>
          <Tick symbol="HYBRID"   val={`${stats.hybrid}s`}   chg={-Number(stats.hybrid)}   up={true}/>
          <Tick symbol="FCFS"     val={`${stats.fcfs}s`}     chg={Number(stats.fcfs)}      up={false}/>
          <Tick symbol="PRIORITY" val={`${stats.priority}s`} chg={Number(stats.priority)}  up={false}/>
          <div style={{ flex:1 }}/>
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"0 14px", borderLeft:"1px solid #333", flexShrink:0 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:connected?"#22c55e":C.red, animation:connected?"blink 2s infinite":"none" }}/>
            <span style={{ fontFamily:C.mono, fontSize:10, color:connected?"#22c55e":C.red }}>{connected?"LIVE":"OFFLINE"}</span>
            <span style={{ fontFamily:C.mono, fontSize:10, color:"#555", marginLeft:8 }}>TK{tick}</span>
          </div>
        </div>

        {/* Nav */}
        <div style={{ background:C.navBg, padding:"0 24px", display:"flex", alignItems:"center", height:44 }}>
          <div style={{ fontFamily:C.serif, fontSize:22, fontWeight:"bold", color:"#fff", marginRight:32 }}>Orderly</div>
          {TABS.map((tab,i)=>(
            <div key={i} onClick={()=>setActiveTab(i)} style={{
              fontFamily:C.sans, fontSize:12, cursor:"pointer",
              color:activeTab===i?"#f5a623":"#ccc",
              padding:"0 14px", height:"100%", display:"flex", alignItems:"center",
              borderBottom:activeTab===i?"2px solid #f5a623":"2px solid transparent",
              transition:"color 0.15s, border-color 0.15s",
            }}>{tab}</div>
          ))}
          <div style={{ flex:1 }}/>
          {isCrash && (
            <div style={{ background:C.red, color:"#fff", fontFamily:C.sans, fontSize:11, fontWeight:"bold", padding:"4px 12px", letterSpacing:"0.08em", animation:"blink 1s infinite" }}>
              ● MARKET CRASH ACTIVE
            </div>
          )}
        </div>

        {/* Page title */}
        <div style={{ borderBottom:`1px solid ${C.border}`, padding:"18px 24px 14px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:20 }}>
          <div>
            <h1 style={{ fontFamily:C.serif, fontSize:26, fontWeight:"bold", letterSpacing:"-0.02em", marginBottom:5 }}>
              {TABS[activeTab]}
            </h1>
            <p style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted, lineHeight:1.5 }}>
              {activeTab===0 && "Live simulated market data — price movement, order book, and queue depth in real time."}
              {activeTab===1 && "Compare FCFS, Priority, and Hybrid scheduling algorithms running simultaneously on the same order queue."}
              {activeTab===2 && "Analyze queue depth, overflow events, and the OS ready-queue analog during burst load."}
              {activeTab===3 && "Full OS concept mapping — how each component relates to operating system scheduling theory."}
              {activeTab===4 && "Session performance metrics — average wait time, improvement percentages, and system log."}
            </p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0, minWidth:300 }}>
            <OsBadge label="FCFS"     desc="Non-preemptive, arrival order"             color={C.red}/>
            <OsBadge label="Priority" desc="Priority-first, starvation risk"            color={C.amber}/>
            <OsBadge label="Hybrid"   desc="Priority + aging = MLFQ equivalent"         color={C.green}/>
          </div>
        </div>

        {/* Crash banner */}
        {isCrash && (
          <div style={{ background:C.redBg, borderBottom:`1px solid ${C.red}`, padding:"8px 24px", display:"flex", alignItems:"center", gap:24, animation:"slideIn 0.3s ease" }}>
            <span style={{ fontFamily:C.sans, fontSize:12, fontWeight:"bold", color:C.red }}>● BURST LOAD EVENT</span>
            <span style={{ fontFamily:C.sans, fontSize:12, color:C.textMid }}>20 orders/tick arriving · 3/tick processed · queue: {queue} · OS ready-queue overflow</span>
            <div style={{ flex:1 }}/>
            <span style={{ fontFamily:C.mono, fontSize:11, color:C.textMuted }}>Hybrid scheduler minimizing wait time</span>
          </div>
        )}

        {/* Tab content */}
        <div style={{ padding:"20px 24px 32px" }}>
          {activeTab===0 && <MarketsTab price={price} prevPrice={prevPrice} priceHist={priceHist} history={history} queue={queue} isCrash={isCrash} buyOrders={buyOrders} sellOrders={sellOrders} stats={stats} order={order} log={log}/>}
          {activeTab===1 && <SchedulersTab history={history} stats={stats}/>}
          {activeTab===2 && <QueueTab history={history} queue={queue} isCrash={isCrash}/>}
          {activeTab===3 && <OsConceptsTab/>}
          {activeTab===4 && <PerformanceTab stats={stats} history={history} log={log} benchmarkResult={benchmarkResult} benchmarkRunning={benchmarkRunning} runBenchmark={runBenchmark} starvationMode={starvationMode} toggleStarvation={toggleStarvation} userTypeCounts={userTypeCounts}/>}
        </div>

        <div style={{ borderTop:`1px solid ${C.border}`, padding:"10px 24px", display:"flex", justifyContent:"space-between", background:C.bgSection }}>
          <span style={{ fontFamily:C.sans, fontSize:11, color:C.textMuted }}>ORDERLY Trading Scheduler · OS Project · FCFS vs Priority vs Hybrid (MLFQ)</span>
          <span style={{ fontFamily:C.mono, fontSize:10, color:C.textMuted }}>Processing cap: 3/tick · Crash prob: 20% · Burst: 20 orders/tick</span>
        </div>
      </div>
    </>
  );
}