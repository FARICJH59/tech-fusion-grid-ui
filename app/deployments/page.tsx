"use client";

import { useState } from "react";

type Target = "cloud" | "edge" | "pi" | "jetson" | "local";

export default function DeploymentsPage() {
  const [artifact, setArtifact] = useState("");
  const [target, setTarget] = useState<Target>("edge");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function deploy() {
    setBusy(true);
    setResult("");
    try {
      const parsed = JSON.parse(artifact);
      const response = await fetch("/api/deployments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: parsed.tenantId, artifact: parsed, target }),
      });
      setResult(JSON.stringify(await response.json(), null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "deployment request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 40, background: "#070b12", color: "#eef3f8", fontFamily: "Inter,Arial,sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "auto" }}>
        <div style={{ letterSpacing: ".18em", fontSize: 12, color: "#72a7ff" }}>HOARE · DEPLOYMENT CONTROL PLANE</div>
        <h1 style={{ fontSize: 48, marginBottom: 10 }}>Governed deployment</h1>
        <p style={{ color: "#9ba8b8", lineHeight: 1.6 }}>Submit an already-created HOARE artifact. Deployment is re-checked for tenant binding and governance before a release is approved.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, marginTop: 28 }}>
          <textarea value={artifact} onChange={(e) => setArtifact(e.target.value)} placeholder='Paste the artifact JSON returned by /api/builder' style={{ minHeight: 430, background: "#080e17", color: "#edf3fa", border: "1px solid #29384c", borderRadius: 12, padding: 16, fontFamily: "monospace" }} />
          <section style={{ background: "#0d1420", border: "1px solid #202d40", borderRadius: 16, padding: 22, height: "fit-content" }}>
            <h2>Target</h2>
            <select value={target} onChange={(e) => setTarget(e.target.value as Target)} style={{ width: "100%", padding: 12, background: "#080e17", color: "#eef3f8", border: "1px solid #29384c", borderRadius: 10 }}>
              <option value="cloud">Cloud</option><option value="edge">Edge</option><option value="pi">Raspberry Pi</option><option value="jetson">Jetson</option><option value="local">Local</option>
            </select>
            <div style={{ margin: "22px 0", color: "#93a2b6", lineHeight: 1.7, fontSize: 13 }}>Identity → Tenant → Governance → Artifact → Deployment Gate → Target Adapter</div>
            <button onClick={deploy} disabled={busy || !artifact.trim()} style={{ width: "100%", padding: 13, border: 0, borderRadius: 10, fontWeight: 800 }}>{busy ? "Checking…" : "Request governed deployment"}</button>
          </section>
        </div>
        {result && <pre style={{ marginTop: 20, padding: 16, background: "#050910", border: "1px solid #1e2b3e", borderRadius: 12, overflow: "auto" }}>{result}</pre>}
      </div>
    </main>
  );
}
