"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tool = {
  name: string;
  description: string;
  parameters: Record<string, string>;
};

export default function HoareToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState<Tool | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/hoare/tools")
      .then((r) => r.json())
      .then((d) => setTools(d.tools ?? []));
  }, []);

  function selectTool(tool: Tool) {
    setSelected(tool);
    setParams(Object.fromEntries(Object.keys(tool.parameters).map((k) => [k, ""])));
    setResult(null);
  }

  async function runTool() {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/hoare/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: selected.name, parameters: params }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data.result ?? data.error, null, 2));
    } catch {
      setResult("Error calling tool.");
    } finally {
      setRunning(false);
    }
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
