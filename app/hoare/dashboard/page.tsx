"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Session = {
  id: string;
  createdAt: string;
  messages: { role: string; content: string; timestamp: string }[];
};

export default function HoareDashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tools, setTools] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/hoare/session").then((r) => r.json()),
      fetch("/api/hoare/tools").then((r) => r.json()),
    ]).then(([sessionData, toolData]) => {
      setSessions(sessionData.sessions ?? []);
      setTools(toolData.tools ?? []);
      setLoading(false);
    });
  }, []);

  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

  const stats = [
    { label: "Active Sessions", value: sessions.length },
    { label: "Total Messages", value: totalMessages },
    { label: "Available Tools", value: tools.length },
    { label: "Agent Status", value: "Online" },
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
        Agent session metrics and activity overview
      </p>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : (
        <>
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
          {sessions.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              No sessions yet.{" "}
              <Link href="/hoare/chat" style={{ color: "#6366f1" }}>
                Start a chat
              </Link>{" "}
              to create one.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: "#162033",
                    border: "1px solid #263248",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.id}</div>
                  <div style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
                    Created: {new Date(s.createdAt).toLocaleString()} &nbsp;|&nbsp;{" "}
                    {s.messages.length} message(s)
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 40 }}>
        <Link href="/hoare" style={{ color: "#6366f1" }}>
          ← Back to HOARE
        </Link>
      </div>
    </main>
  );
}
