"use client";

import { useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";

type AgentResult = {
  repair_trace: unknown[];
  output: unknown;
  agent: string;
  timestamp: string;
};

export default function AgentOrchestrationPanel() {
  const { user } = useSupabase();
  const [agentName, setAgentName] = useState("data-parser");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runAgent = async () => {
    if (!input.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_HOARE_API_URL}/agent/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: agentName,
            input,
            user: user?.email ?? null,
          }),
        }
      );

      const data = await res.json();
      setResult({
        repair_trace: data.repair_trace ?? [],
        output: data.output ?? null,
        agent: agentName,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Agent run error:", err);
    }

    setLoading(false);
  };

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
      <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Agent Orchestration</h1>
      <p style={{ color: "#9ca3af", marginBottom: 24 }}>
        Trigger Hoare-compatible agents and inspect repair traces.
      </p>

      <div
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 900,
          background: "#162033",
          border: "1px solid #263248",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase" }}>
            Agent
          </span>
          <select
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            style={{
              background: "#0f172a",
              color: "#fff",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <option value="data-parser">data-parser</option>
            <option value="anomaly-detector">anomaly-detector</option>
            <option value="compliance-auditor">compliance-auditor</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase" }}>
            Input payload
          </span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"device_id":"inv-7","event":"voltage_drop"}'
            rows={8}
            style={{
              background: "#0f172a",
              color: "#e5e7eb",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: 12,
              resize: "vertical",
              fontFamily: "monospace",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={runAgent}
            disabled={loading || !input.trim()}
            style={{
              background: loading ? "#334155" : "#065f46",
              color: "#d1fae5",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Running..." : "Run Agent"}
          </button>
          <span style={{ color: "#9ca3af", fontSize: 12 }}>
            User context: {user?.email ?? "anonymous"}
          </span>
        </div>
      </div>

      {result && (
        <section
          style={{
            maxWidth: 900,
            background: "#111827",
            border: "1px solid #263248",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Latest Result</h2>
          <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 16 }}>
            Agent: <strong>{result.agent}</strong> · {new Date(result.timestamp).toLocaleString()}
          </p>

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <h3 style={{ marginBottom: 8 }}>Output</h3>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "#0b1220",
                  border: "1px solid #1f2937",
                  borderRadius: 8,
                  overflowX: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>

            <div>
              <h3 style={{ marginBottom: 8 }}>Repair Trace</h3>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "#0b1220",
                  border: "1px solid #1f2937",
                  borderRadius: 8,
                  overflowX: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(result.repair_trace, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
