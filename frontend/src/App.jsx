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
        ...prev.slice(-30),
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
    <div style={{
      background: "#0f172a",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      padding: "20px"
    }}>
      {/* MAIN CONTAINER */}
      <div style={{
        width: "100%",
        maxWidth: "1100px",
        color: "white",
        fontFamily: "sans-serif"
      }}>

        {/* HEADER */}
        <h1 style={{ color: "#38bdf8", textAlign: "center" }}>
          📈 ORDERLY Terminal
        </h1>

        <h3 style={{
          textAlign: "center",
          color: queue > 30 ? "#ef4444" : "#22c55e"
        }}>
          {queue > 30 ? "🚨 Market Under Stress" : "✅ Stable Market"}
        </h3>

        {/* MARKET SUMMARY */}
        <div style={{
          display: "flex",
          gap: "20px",
          marginTop: "20px",
          marginBottom: "20px"
        }}>
          <div style={{ flex: 1, background: "#1e293b", padding: "15px", borderRadius: "10px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8" }}>💰 PRICE</p>
            <h2>{price}</h2>
          </div>

          <div style={{ flex: 1, background: "#1e293b", padding: "15px", borderRadius: "10px", textAlign: "center" }}>
            <p style={{ color: "#94a3b8" }}>📦 QUEUE</p>
            <h2>{queue}</h2>
          </div>

          <div style={{
            flex: 1,
            background: "#1e293b",
            padding: "15px",
            borderRadius: "10px",
            textAlign: "center",
            border: queue > 30 ? "1px solid #ef4444" : "transparent"
          }}>
            <p style={{ color: "#94a3b8" }}>⚡ STATUS</p>
            <h2 style={{ color: queue > 30 ? "#ef4444" : "#22c55e" }}>
              {queue > 30 ? "STRESS" : "STABLE"}
            </h2>
          </div>
        </div>

        {/* EXECUTION */}
        <div style={{
          background: "#020617",
          padding: "10px",
          borderRadius: "8px",
          marginBottom: "20px",
          textAlign: "center"
        }}>
          ⚡ Executing Order #{order?.order_id}
        </div>

        {/* ORDER BOOK */}
        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ flex: 1, background: "#1e293b", padding: "15px", borderRadius: "10px" }}>
            <h3 style={{ color: "#22c55e" }}>🟢 BUY Orders</h3>
            {buyOrders.map((o, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span>#{o.order_id}</span>
                <span>{o.quantity}</span>
                <span>P{o.priority}</span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, background: "#1e293b", padding: "15px", borderRadius: "10px" }}>
            <h3 style={{ color: "#ef4444" }}>🔴 SELL Orders</h3>
            {sellOrders.map((o, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                <span>#{o.order_id}</span>
                <span>{o.quantity}</span>
                <span>P{o.priority}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GRAPH */}
        <div style={{ marginTop: "30px", background: "#1e293b", padding: "20px", borderRadius: "10px" }}>
          <h3>📊 Scheduler Comparison</h3>

          <LineChart width={800} height={300} data={history}>
            <XAxis dataKey="id" tick={false} />
            <YAxis />
            <Tooltip />
            <Legend />

            <Line type="natural" dataKey="fcfs" stroke="#ef4444" strokeWidth={3} />
            <Line type="natural" dataKey="priority" stroke="#facc15" strokeWidth={2} />
            <Line type="natural" dataKey="hybrid" stroke="#22c55e" strokeWidth={3} />
          </LineChart>
        </div>

        {/* PERFORMANCE */}
        <div style={{ marginTop: "30px", background: "#1e293b", padding: "20px", borderRadius: "10px" }}>
          <h3>📊 Performance Comparison</h3>

          <p style={{ color: stats.fcfs == best ? "#22c55e" : "white" }}>
            🔴 FCFS: {stats.fcfs}
          </p>

          <p style={{ color: stats.priority == best ? "#22c55e" : "white" }}>
            🟡 Priority: {stats.priority}
          </p>

          <p style={{ color: stats.hybrid == best ? "#22c55e" : "white" }}>
            🟢 Hybrid: {stats.hybrid}
          </p>
        </div>

        {/* QUEUE GRAPH */}
        <div style={{ marginTop: "20px", background: "#1e293b", padding: "20px", borderRadius: "10px" }}>
          <h3>📦 Queue Buildup</h3>

          <LineChart width={800} height={200} data={history}>
            <XAxis dataKey="id" tick={false} />
            <YAxis />
            <Tooltip />
            <Line type="natural" dataKey="queue" stroke="#a855f7" strokeWidth={3} />
          </LineChart>
        </div>

      </div>
    </div>
  );
}

export default App;