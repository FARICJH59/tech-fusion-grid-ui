"use client";

import { useState } from "react";
import Link from "next/link";
import { useHoare } from "@/hooks/useHoare";

export default function HoareChatPage() {
  const { session, messages, loading, error, sendMessage } = useHoare();
  const [input, setInput] = useState("");

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await sendMessage(text);
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
        Session: {session?.id ?? "initializing…"}
      </p>

      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 8 }}>
          ⚠ {error}
        </p>
      )}

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
          <p style={{ color: "#6b7280" }}>Send a message to start chatting with HOARE.</p>
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
          placeholder="Ask HOARE about telemetry, anomalies, or tools…"
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
