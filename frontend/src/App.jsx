import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";

function App() {
  const [buyOrders, setBuyOrders] = useState([]);
  const [sellOrders, setSellOrders] = useState([]);
  const [price, setPrice] = useState(0);
  const [history, setHistory] = useState([]);
  const [order, setOrder] = useState(null);
  const [queue, setQueue] = useState(0);
  const [mode, setMode] = useState("all");

  const [stats, setStats] = useState({
    fcfs: 0,
    priority: 0,
    hybrid: 0
  });

  const best = Math.min(
    Number(stats.fcfs) || 0,
    Number(stats.priority) || 0,
    Number(stats.hybrid) || 0
  );

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");

    ws.onopen = () => console.log("Connected ✅");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      setPrice(data.price);
      setOrder(data.hybrid);
      setQueue(data.queue_length);

      setBuyOrders(data.buy_orders || []);
      setSellOrders(data.sell_orders || []);

      setStats((prev) => {
        const newFcfs = Number(data.fcfs?.wait_time || 0);
        const newPriority = Number(data.priority?.wait_time || 0);
        const newHybrid = Number(data.hybrid?.wait_time || 0);

        return {
          fcfs: ((Number(prev.fcfs) + newFcfs) / 2).toFixed(2),
          priority: ((Number(prev.priority) + newPriority) / 2).toFixed(2),
          hybrid: ((Number(prev.hybrid) + newHybrid) / 2).toFixed(2)
        };
      });

      setHistory((prev) => [
        ...prev.slice(-20),
        {
          id: Date.now(),
          fcfs: data.fcfs?.wait_time || 0,
          priority: data.priority?.wait_time || 0,
          hybrid: data.hybrid?.wait_time || 0,
          queue: data.queue_length
        }
      ]);
    };

    return () => ws.close();
  }, []);

  return (
    <div
      style={{
        background: "#0f172a",
        color: "white",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "sans-serif"
      }}
    >
      <h1 style={{ color: "#38bdf8" }}>📈 Trading Terminal</h1>
     



     

{/* 🔥 ADD HERE */}
{queue > 30 && (
  <h3 style={{ color: "#ef4444" }}>
    🚨 Market Under Stress
  </h3>
)}

<h3>⚡ Executing: {order?.order_id}</h3>

      {/* ORDER BOOK */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginTop: "20px"
        }}
      >
        {/* BUY SIDE */}
        <div
          style={{
            flex: 1,
            background: "#1e293b",
            padding: "15px",
            borderRadius: "10px"
          }}
        >
          <h3 style={{ color: "#22c55e" }}>🟢 BUY Orders</h3>

          {buyOrders.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#94a3b8" }}>No buy orders</p>
          ) : (
            buyOrders.map((o, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #334155",
                  padding: "6px 0",
                  fontSize: "13px"
                }}
              >
                <span style={{ color: "#94a3b8" }}>#{o.order_id}</span>
                <span>{o.quantity} qty</span>
                <span>P{o.priority}</span>
              </div>
            ))
          )}
        </div>

        {/* SELL SIDE */}
        <div
          style={{
            flex: 1,
            background: "#1e293b",
            padding: "15px",
            borderRadius: "10px"
          }}
        >
          <h3 style={{ color: "#ef4444" }}>🔴 SELL Orders</h3>

          {sellOrders.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#94a3b8" }}>No sell orders</p>
          ) : (
            sellOrders.map((o, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #334155",
                  padding: "6px 0",
                  fontSize: "13px"
                }}
              >
                <span style={{ color: "#94a3b8" }}>#{o.order_id}</span>
                <span>{o.quantity} qty</span>
                <span>P{o.priority}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* TOP PANEL */}
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: 1, background: "#1e293b", padding: "15px", borderRadius: "10px" }}>
          <h2>💰 Price: {price}</h2>
          <h3>📦 Queue: {queue}</h3>

          {order && (
            <>
              <p>ID: {order.order_id}</p>
              <p style={{ color: order.type === "BUY" ? "#22c55e" : "#ef4444" }}>
                {order.type}
              </p>
              <p>Priority: {order.priority}</p>
              <p>Wait: {order.wait_time}</p>
            </>
          )}
        </div>

        <div style={{ flex: 1, background: "#1e293b", padding: "15px", borderRadius: "10px", maxHeight: "200px", overflow: "auto" }}>
          <h3>🧾 Queue Preview</h3>
          {history.slice(-10).map((h, i) => (
            <div key={i} style={{ fontSize: "12px", borderBottom: "1px solid #334155", padding: "4px" }}>
              FCFS: {h.fcfs} | P: {h.priority} | H: {h.hybrid}
            </div>
          ))}
        </div>
      </div>

      {/* BUTTONS */}
      <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
        {["all", "fcfs", "priority", "hybrid"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              backgroundColor: mode === m ? "#38bdf8" : "#334155",
              color: "white"
            }}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* GRAPH */}
      <div style={{ marginTop: "30px", background: "#1e293b", padding: "20px", borderRadius: "10px" }}>
        <h3>📊 Scheduler Comparison</h3>

        <LineChart width={800} height={300} data={history}>


          <XAxis dataKey="id" tick={false} />
          <YAxis />
          <Tooltip />
          <Legend />

          <YAxis
            label={{
              value: "Wait Time ↑",
              angle: -90,
              position: "insideLeft",
              fill: "white"
            }}
          />

          <XAxis
            dataKey="id"
            tick={false}
            label={{
              value: "Time →",
              position: "insideBottomRight",
              fill: "white"
            }}
          />

          {(mode === "all" || mode === "fcfs") && (
            <Line type="monotone" dataKey="fcfs" stroke="#3b82f6" strokeWidth={2} />
          )}

          {(mode === "all" || mode === "priority") && (
            <Line type="monotone" dataKey="priority" stroke="#ef4444" strokeWidth={2} />
          )}

          {(mode === "all" || mode === "hybrid") && (
            <Line type="monotone" dataKey="hybrid" stroke="#22c55e" strokeWidth={2} />
          )}
        </LineChart>
      </div>

      {/* 🔥 PERFORMANCE PANEL */}
      <div style={{
        marginTop: "30px",
        background: "#1e293b",
        padding: "20px",
        borderRadius: "10px"
      }}>
        <h3>📊 Performance Comparison</h3>

        <div style={{ marginTop: "10px" }}>
          <p style={{ color: stats.fcfs == best ? "#22c55e" : "white" }}>
            🔵 FCFS Avg Wait: {stats.fcfs}
          </p>

          <p style={{ color: stats.priority == best ? "#22c55e" : "white" }}>
            🔴 Priority Avg Wait: {stats.priority}
          </p>

          <p style={{ color: stats.hybrid == best ? "#22c55e" : "white" }}>
            🟢 Hybrid Avg Wait: {stats.hybrid}
          </p>
        </div>
      </div>

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#94a3b8" }}>
        Hybrid scheduling reduces wait time during high load by balancing priority and arrival time.
      </div>



      {/* QUEUE GRAPH */}
      <div style={{ marginTop: "20px", background: "#1e293b", padding: "20px", borderRadius: "10px" }}>
        <h3>📦 Queue Buildup</h3>

        <LineChart width={800} height={200} data={history}>
          <XAxis dataKey="id" tick={false} />
          <YAxis
            label={{
              value: "Wait Time ↑",
              angle: -90,
              position: "insideLeft",
              fill: "white"
            }}
          />
          <XAxis
            dataKey="id"
            tick={false}
            label={{
              value: "Time →",
              position: "insideBottomRight",
              fill: "white"
            }}
          />
          <YAxis />
          <Tooltip />

          <Line type="monotone" dataKey="queue" stroke="#a855f7" strokeWidth={2} />
        </LineChart>

      </div>
    </div>
    
  );
}

export default App;