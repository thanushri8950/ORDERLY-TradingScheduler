import { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

function App() {

  const [data, setData] = useState(null);
  const [visibleOrders, setVisibleOrders] = useState([]);
  const [n, setN] = useState(50);
  const [burst, setBurst] = useState(true);
  const [algo, setAlgo] = useState("predictive");
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    setLoading(true);

    const res = await axios.get(
      `http://127.0.0.1:8000/run?n=${n}&burst=${burst}`
    );

    setData(res.data);
    setVisibleOrders([]);

    setLoading(false);
  };

  useEffect(() => {
    if (!data) return;

    let i = 0;

    const interval = setInterval(() => {
      setVisibleOrders((prev) => {
        if (i < data.orders.length) {
          return [...prev, data.orders[i]];
        }
        return prev;
      });

      i++;

      if (i >= data.orders.length) {
        clearInterval(interval);
      }

    }, burst ? 20 : 60); // smoother speed

    return () => clearInterval(interval);
  }, [data]);

  const chartData = data ? [
    { name: "FCFS", value: data.metrics.fcfs_avg_wait },
    { name: "Priority", value: data.metrics.priority_avg_wait },
    { name: "Predictive", value: data.metrics.predictive_avg_wait }
  ] : [];

  const timelineData = data
    ? data[algo].map((o) => ({
        name: `O${o.order_id}`,
        start: o.start_time,
        duration: o.burst_time
      }))
    : [];

  return (
    <div style={{
      background: "#020617",
      minHeight: "100vh",
      color: "#e2e8f0",
      padding: "20px",
      fontFamily: "sans-serif"
    }}>

      {/* 🔥 LOADING OVERLAY */}
      {loading && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(2,6,23,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="loader"></div>
            <p style={{ marginTop: "10px" }}>Running simulation...</p>
          </div>
        </div>
      )}

      <h1 style={{
        color: "#38bdf8",
        fontWeight: "600"
      }}>
        📈 ORDERLY Trading Dashboard
      </h1>

      {/* CONTROLS */}
      <div style={{ marginTop: "20px", display: "flex", gap: "20px" }}>
        
        <div>
          <label>Orders: </label>
          <input
            type="number"
            value={n}
            onChange={(e) => setN(e.target.value)}
          />
        </div>

        <div>
          <label>Burst: </label>
          <input
            type="checkbox"
            checked={burst}
            onChange={() => setBurst(!burst)}
          />
        </div>

        <div>
          <label>Algorithm: </label>
          <select
            value={algo}
            onChange={(e) => setAlgo(e.target.value)}
          >
            <option value="fcfs">FCFS</option>
            <option value="priority">Priority</option>
            <option value="predictive">Predictive</option>
          </select>
        </div>

      </div>

      {/* BUTTON */}
      <button
        onClick={runSimulation}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          border: "none",
          borderRadius: "8px",
          color: "white",
          fontWeight: "600",
          cursor: "pointer",
          boxShadow: "0 0 10px rgba(34,197,94,0.4)"
        }}
      >
        Run Simulation
      </button>

      {/* METRICS */}
      {data && (
        <div style={{ display: "flex", gap: "20px", marginTop: "30px" }}>
          <div style={cardStyle}>
            FCFS: {data.metrics.fcfs_avg_wait.toFixed(2)}
          </div>
          <div style={cardStyle}>
            Priority: {data.metrics.priority_avg_wait.toFixed(2)}
          </div>
          <div style={cardStyle}>
            Predictive: {data.metrics.predictive_avg_wait.toFixed(2)}
          </div>
        </div>
      )}

      {/* CHART */}
      {data && (
        <div style={{ marginTop: "30px" }}>
          <BarChart width={600} height={300} data={chartData}>
            <CartesianGrid stroke="#334155" />
            <XAxis dataKey="name" stroke="white" />
            <YAxis stroke="white" />
            <Tooltip />
            <Bar dataKey="value" fill="#22c55e" />
          </BarChart>
        </div>
      )}

      {/* TIMELINE */}
      {data && (
        <div style={{ marginTop: "40px" }}>
          <h2>⏱ Execution Timeline</h2>

          <BarChart
            width={800}
            height={300}
            data={timelineData}
            layout="vertical"
          >
            <CartesianGrid stroke="#334155" />
            <XAxis type="number" stroke="white" />
            <YAxis dataKey="name" type="category" stroke="white" />
            <Tooltip />

            <Bar dataKey="start" stackId="a" fill="transparent" />
            <Bar dataKey="duration" stackId="a" fill="#38bdf8" />
          </BarChart>
        </div>
      )}

      {/* TABLE */}
      {data && (
        <table style={{ marginTop: "20px", width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>User</th>
              <th>Priority</th>
              <th>Burst</th>
            </tr>
          </thead>

          <tbody>
            {visibleOrders.map((o) => (
              <tr key={o.order_id}>
                <td>{o.order_id}</td>
                <td style={{
                  color: o.type === "BUY" ? "#22c55e" : "#ef4444"
                }}>
                  {o.type}
                </td>
                <td>{o.user_type}</td>
                <td>{o.priority}</td>
                <td>{o.burst_time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </div>
  );
}

const cardStyle = {
  background: "#0f172a",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid #1e293b",
  minWidth: "140px",
  textAlign: "center"
};

export default App;