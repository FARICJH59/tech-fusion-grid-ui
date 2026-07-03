"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useHoare } from "@/hooks/useHoare";

export default function HoareDashboardPage() {
  const { sessions, tools, loading, error } = useHoare();

  const totalMessages = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.messages ?? 0), 0),
    [sessions]
  );

  const stats = [
    { label: "Sessions", value: sessions.length },
    { label: "Messages", value: totalMessages },
    { label: "Tools", value: tools.length },
    { label: "Backend", value: error ? "Unreachable" : loading ? "Connecting…" : "Connected" },
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
        Live activity overview from the HOARE backend
      </p>

      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 16 }}>
          ⚠ {error}
        </p>
      )}

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

      <h2 style={{ marginBottom: 16 }}>Sessions</h2>
      {loading && sessions.length === 0 && (
        <p style={{ color: "#9ca3af" }}>Loading sessions…</p>
      )}
      {!loading && sessions.length === 0 && (
        <p style={{ color: "#6b7280" }}>No sessions found.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sessions.map((session) => (
          <div
            key={String(session.id)}
            style={{
              background: "#162033",
              border: "1px solid #263248",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{String(session.id)}</div>
            <div style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
              {session.createdAt
                ? `Created: ${new Date(String(session.createdAt)).toLocaleString()}`
                : ""}
              {session.messages !== undefined
                ? ` | ${session.messages} message(s)`
                : ""}
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
