"use client";

import Link from "next/link";

const metrics = [
  { title: "Active Agents", value: "24" },
  { title: "IoT Devices", value: "1,284" },
  { title: "Events / sec", value: "18.7K" },
  { title: "Anomalies", value: "3" },
  { title: "Runtime Health", value: "99.98%" },
  { title: "Tenants", value: "42" },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#fff",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: 8 }}>
        Tech Fusion Foundary
      </h1>

      <p style={{ color: "#9ca3af", marginBottom: 32 }}>
        Enterprise Autonomous AI + IoT Control Plane
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
          marginBottom: 40,
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.title}
            style={{
              background: "#162033",
              padding: 20,
              borderRadius: 12,
              border: "1px solid #263248",
            }}
          >
            <h3>{metric.title}</h3>
            <h2>{metric.value}</h2>
          </div>
        ))}
      </div>

      <h2 style={{ marginBottom: 20 }}>Platform Modules</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
        }}
      >
        <Link href="/telemetry">📡 Telemetry</Link>
        <Link href="/execution-plane">⚙️ Execution Plane</Link>
        <Link href="/audit">🛡 Audit Center</Link>
        <Link href="/billing/subscribe">💳 Subscribe</Link>
      </div>
    </main>
  );
}
