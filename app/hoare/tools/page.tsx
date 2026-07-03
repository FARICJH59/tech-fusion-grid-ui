"use client";

import { useState } from "react";
import Link from "next/link";

type Tool = {
  name: string;
  description: string;
  parameters: Record<string, string>;
};

const LOCAL_TOOLS: Tool[] = [
  {
    name: "telemetry_query",
    description: "Simulate telemetry query results in the UI",
    parameters: { deviceId: "string", metric: "string", window: "string" },
  },
  {
    name: "audit_log",
    description: "Simulate adding an audit entry",
    parameters: { action: "string", details: "string" },
  },
  {
    name: "execute_command",
    description: "Simulate command dispatch from the UI",
    parameters: { deviceId: "string", command: "string", payload: "string" },
  },
  {
    name: "anomaly_detect",
    description: "Simulate anomaly detection summary",
    parameters: { stream: "string", threshold: "string" },
  },
];

function runLocalTool(tool: Tool, params: Record<string, string>) {
  const timestamp = new Date().toISOString();

  if (tool.name === "telemetry_query") {
    return {
      deviceId: params.deviceId || "demo-device",
      metric: params.metric || "latency",
      value: 42.7,
      unit: "ms",
      timestamp,
      source: "frontend-demo",
    };
  }

  if (tool.name === "audit_log") {
    return {
      logged: true,
      action: params.action || "demo_action",
      details: params.details || "frontend-only simulation",
      timestamp,
      source: "frontend-demo",
    };
  }

  if (tool.name === "execute_command") {
    return {
      queued: true,
      deviceId: params.deviceId || "demo-device",
      command: params.command || "restart",
      payload: params.payload || "{}",
      timestamp,
      source: "frontend-demo",
    };
  }

  return {
    anomaliesFound: 0,
    stream: params.stream || "default-stream",
    threshold: params.threshold || "medium",
    timestamp,
    source: "frontend-demo",
  };
}

export default function HoareToolsPage() {
  const [tools] = useState<Tool[]>(LOCAL_TOOLS);
  const [selected, setSelected] = useState<Tool | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  function selectTool(tool: Tool) {
    setSelected(tool);
    setParams(Object.fromEntries(Object.keys(tool.parameters).map((k) => [k, ""])));
    setResult(null);
  }

  async function runTool() {
    if (!selected) return;
    setRunning(true);
    setResult(null);

    await new Promise((resolve) => setTimeout(resolve, 250));
    const output = runLocalTool(selected, params);
    setResult(JSON.stringify(output, null, 2));

    setRunning(false);
  }

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
      <h1 style={{ fontSize: "2rem", marginBottom: 24 }}>🔧 HOARE Tools</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <h2 style={{ marginBottom: 12, color: "#9ca3af" }}>Available Tools</h2>
          {tools.map((t) => (
            <div
              key={t.name}
              onClick={() => selectTool(t)}
              style={{
                background: selected?.name === t.name ? "#1e2d45" : "#162033",
                border: `1px solid ${selected?.name === t.name ? "#6366f1" : "#263248"}`,
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
                cursor: "pointer",
              }}
            >
              <strong>{t.name}</strong>
              <p style={{ color: "#9ca3af", fontSize: "0.85rem", marginTop: 4 }}>
                {t.description}
              </p>
            </div>
          ))}
        </div>

        <div>
          {selected ? (
            <>
              <h2 style={{ marginBottom: 12, color: "#9ca3af" }}>
                Run: {selected.name}
              </h2>
              {Object.keys(selected.parameters).map((key) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>
                    {key}
                  </label>
                  <input
                    value={params[key] ?? ""}
                    onChange={(e) =>
                      setParams((p) => ({ ...p, [key]: e.target.value }))
                    }
                    placeholder={selected.parameters[key]}
                    style={{
                      width: "100%",
                      background: "#162033",
                      border: "1px solid #263248",
                      borderRadius: 6,
                      padding: "8px 12px",
                      color: "#fff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
              <button
                onClick={runTool}
                disabled={running}
                style={{
                  background: "#6366f1",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                {running ? "Running…" : "Execute"}
              </button>

              {result && (
                <pre
                  style={{
                    background: "#162033",
                    border: "1px solid #263248",
                    borderRadius: 8,
                    padding: 16,
                    fontSize: "0.85rem",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {result}
                </pre>
              )}
            </>
          ) : (
            <p style={{ color: "#6b7280" }}>Select a tool to configure and run it.</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <Link href="/hoare" style={{ color: "#6366f1" }}>
          ← Back to HOARE
        </Link>
      </div>
    </main>
  );
}
