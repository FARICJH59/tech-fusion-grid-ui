"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };

function buildReply(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("telemetry")) {
    return "Frontend demo: telemetry status is stable across all connected views.";
  }
  if (lower.includes("anomaly") || lower.includes("fault")) {
    return "Frontend demo: no critical anomalies are currently displayed.";
  }
  if (lower.includes("tool") || lower.includes("execute")) {
    return "Frontend demo: open the Tools page to run local simulated actions.";
  }

  return `Frontend demo response: received \"${input}\".`;
}

export default function HoareChatPage() {
  const [sessionId] = useState(() =>
    `ui-${crypto.randomUUID().slice(0, 8)}-${Date.now().toString(36)}`
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const placeholder = useMemo(
    () => "Ask HOARE UI demo about telemetry, anomalies, or tools…",
    []
  );

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 250));

    setMessages((prev) => [...prev, { role: "assistant", content: buildReply(text) }]);
    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#fff",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: 4 }}>💬 HOARE Chat</h1>
      <p style={{ color: "#6b7280", fontSize: "0.8rem", marginBottom: 16 }}>
        Local UI session: {sessionId}
      </p>

      <div
        style={{
          flex: 1,
          background: "#162033",
          borderRadius: 12,
          border: "1px solid #263248",
          padding: 20,
          marginBottom: 16,
          minHeight: 400,
          overflowY: "auto",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "#6b7280" }}>Send a message to start the UI-only HOARE demo.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 16,
              textAlign: m.role === "user" ? "right" : "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                background: m.role === "user" ? "#6366f1" : "#1e2d45",
                padding: "8px 14px",
                borderRadius: 10,
                maxWidth: "80%",
                fontSize: "0.95rem",
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && (
          <p style={{ color: "#9ca3af", fontStyle: "italic" }}>HOARE is thinking…</p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: "#162033",
            border: "1px solid #263248",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#fff",
            fontSize: "1rem",
          }}
        />
        <button
          onClick={send}
          disabled={loading}
          style={{
            background: "#6366f1",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/hoare" style={{ color: "#6366f1" }}>
          ← Back to HOARE
        </Link>
      </div>
    </main>
  );
}
