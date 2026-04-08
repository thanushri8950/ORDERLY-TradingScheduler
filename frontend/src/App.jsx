import { useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

function App() {
  const [data, setData] = useState(null);

  const runSimulation = async () => {
    const res = await axios.get("http://127.0.0.1:8000/run");
    setData(res.data);
  };

  const chartData = data ? [
    { name: "FCFS", value: data.metrics.fcfs_avg_wait },
    { name: "Priority", value: data.metrics.priority_avg_wait },
    { name: "Predictive", value: data.metrics.predictive_avg_wait }
  ] : [];

  return (
    <div style={{
      background: "#0f172a",
      minHeight: "100vh",
      color: "white",
      fontFamily: "sans-serif",
      padding: "20px"
    }}>

      {/* HEADER */}
      <h1 style={{ color: "#38bdf8" }}>
        📈 ORDERLY Trading Dashboard
      </h1>

      {/* BUTTON */}
      <button
        onClick={runSimulation}
        style={{
          padding: "10px 20px",
          background: "#22c55e",
          color: "black",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          marginTop: "10px"
        }}
      >
        Run Simulation
      </button>

      {/* METRICS CARDS */}
      {data && (
        <div style={{
          display: "flex",
          gap: "20px",
          marginTop: "30px"
        }}>
          <div style={cardStyle}>
            <h3>FCFS</h3>
            <p>{data.metrics.fcfs_avg_wait.toFixed(2)}</p>
          </div>

          <div style={cardStyle}>
            <h3>Priority</h3>
            <p>{data.metrics.priority_avg_wait.toFixed(2)}</p>
          </div>

          <div style={cardStyle}>
            <h3>Predictive</h3>
            <p>{data.metrics.predictive_avg_wait.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* CHART */}
      {data && (
        <div style={{ marginTop: "40px" }}>
          <h2>📊 Performance Comparison</h2>

          <BarChart width={600} height={300} data={chartData}>
            <CartesianGrid stroke="#334155" />
            <XAxis dataKey="name" stroke="white" />
            <YAxis stroke="white" />
            <Tooltip />
            <Bar dataKey="value" fill="#38bdf8" />
          </BarChart>
        </div>
      )}
        {/* ORDERS TABLE */}
{data && (
  <div style={{ marginTop: "40px" }}>
    <h2>📋 Live Orders</h2>

    <table style={{
      width: "100%",
      borderCollapse: "collapse",
      marginTop: "10px"
    }}>
      <thead>
        <tr style={{ background: "#1e293b" }}>
          <th style={thStyle}>ID</th>
          <th style={thStyle}>Type</th>
          <th style={thStyle}>User</th>
          <th style={thStyle}>Priority</th>
          <th style={thStyle}>Burst</th>
        </tr>
      </thead>

      <tbody>
        {data.orders.slice(0, 15).map((order) => (
          <tr key={order.order_id} style={{ textAlign: "center" }}>
            
            <td style={tdStyle}>{order.order_id}</td>

            <td style={{
              ...tdStyle,
              color: order.type === "BUY" ? "#22c55e" : "#ef4444"
            }}>
              {order.type}
            </td>

            <td style={tdStyle}>{order.user_type}</td>

            <td style={tdStyle}>{order.priority}</td>

            <td style={tdStyle}>{order.burst_time}</td>

          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

    </div>




  );
}

const cardStyle = {
  background: "#1e293b",
  padding: "20px",
  borderRadius: "10px",
  width: "150px",
  textAlign: "center",
  boxShadow: "0 0 10px rgba(0,0,0,0.5)"
};


const thStyle = {
  padding: "10px",
  borderBottom: "1px solid #334155"
};

const tdStyle = {
  padding: "8px",
  borderBottom: "1px solid #1e293b"
};

export default App;