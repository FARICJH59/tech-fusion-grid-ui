"use client";

import { useMemo } from "react";
import Link from "next/link";

const UI_ONLY_SESSIONS = [
  {
    id: "ui-demo-a1",
    createdAt: "2026-07-03T00:05:00.000Z",
    messages: 8,
  },
  {
    id: "ui-demo-b2",
    createdAt: "2026-07-03T01:10:00.000Z",
    messages: 5,
  },
  {
    id: "ui-demo-c3",
    createdAt: "2026-07-03T02:25:00.000Z",
    messages: 11,
  },
];

const UI_ONLY_TOOLS = [
  "telemetry_query",
  "audit_log",
  "execute_command",
  "anomaly_detect",
];

export default function HoareDashboardPage() {
  const totalMessages = useMemo(
    () => UI_ONLY_SESSIONS.reduce((sum, session) => sum + session.messages, 0),
    []
  );

  const stats = [
    { label: "Demo Sessions", value: UI_ONLY_SESSIONS.length },
    { label: "Demo Messages", value: totalMessages },
    { label: "Demo Tools", value: UI_ONLY_TOOLS.length },
    { label: "Runtime", value: "UI Only" },
  ];

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
      <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>📊 HOARE Dashboard</h1>
      <p style={{ color: "#9ca3af", marginBottom: 32 }}>
        Front-end only activity overview (no backend services)
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 16,
          marginBottom: 40,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "#162033",
              border: "1px solid #263248",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ color: "#9ca3af", fontSize: "0.85rem", marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginBottom: 16 }}>Demo Sessions</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {UI_ONLY_SESSIONS.map((session) => (
          <div
            key={session.id}
            style={{
              background: "#162033",
              border: "1px solid #263248",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{session.id}</div>
            <div style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
              Created: {new Date(session.createdAt).toLocaleString()} &nbsp;|&nbsp; {session.messages} message(s)
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        <Link href="/hoare" style={{ color: "#6366f1" }}>
          ← Back to HOARE
        </Link>
      </div>
    </main>
  );
}
