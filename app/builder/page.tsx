"use client";

import { useState } from "react";

type Kind = "agent" | "workflow" | "service" | "iot";

export default function BuilderPage() {
  const [kind, setKind] = useState<Kind>("agent");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capabilities, setCapabilities] = useState("observe, decide, execute");
  const [mode, setMode] = useState<"controlled" | "autonomous">("controlled");
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function createResource() {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch("/api/builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          description,
          capabilities: capabilities.split(",").map((x) => x.trim()).filter(Boolean),
          mode,
        }),
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="builder-shell">
      <section className="hero">
        <div>
          <div className="eyebrow">TECH FUSION · HOARE BUILDER</div>
          <h1>Build the system that builds the systems.</h1>
          <p>Define an agent, workflow, service, or IoT resource. HOARE turns intent into a governed artifact without binding the builder to a cloud provider.</p>
        </div>
        <div className="lifecycle"><span>01 Design</span><span>02 Govern</span><span>03 Deploy</span></div>
      </section>

      <section className="grid">
        <div className="card form-card">
          <h2>Resource Builder</h2>
          <div className="identity-note">Identity and tenant are taken from the authenticated session. They are not editable from the browser.</div>
          <label>Resource name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="inventory-agent" /></label>
          <label>Type<select value={kind} onChange={(e) => setKind(e.target.value as Kind)}><option value="agent">Agent</option><option value="workflow">Workflow</option><option value="service">Service</option><option value="iot">IoT</option></select></label>
          <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should this resource do?" /></label>
          <label>Capabilities<input value={capabilities} onChange={(e) => setCapabilities(e.target.value)} /></label>
          <label>Execution mode<select value={mode} onChange={(e) => setMode(e.target.value as "controlled" | "autonomous")}><option value="controlled">Controlled</option><option value="autonomous">Autonomous</option></select></label>
          <button onClick={createResource} disabled={busy || !name.trim()}>{busy ? "Building…" : "Create governed resource"}</button>
        </div>

        <div className="card">
          <h2>Control Plane Contract</h2>
          <div className="contract"><b>Identity</b><span>Authenticated principal → tenant scope → role</span></div>
          <div className="contract"><b>Governance</b><span>Policy + RBAC/ABAC + tenant isolation</span></div>
          <div className="contract"><b>Artifact</b><span>Signed, versioned HOARE resource</span></div>
          <div className="contract"><b>Verification</b><span>Artifact and policy verification before runtime</span></div>
          <div className="contract"><b>Runtime</b><span>Provider-neutral execution target</span></div>
          {result && <pre className="result">{result}</pre>}
        </div>
      </section>

      <style jsx>{`
        .builder-shell{min-height:100vh;background:#070b12;color:#eef3f8;padding:48px;font-family:Inter,Arial,sans-serif}.hero{max-width:1180px;margin:0 auto 32px;display:flex;justify-content:space-between;gap:30px;align-items:end}.eyebrow{font-size:12px;letter-spacing:.18em;color:#72a7ff;margin-bottom:12px}.hero h1{font-size:clamp(36px,5vw,68px);line-height:1;margin:0 0 16px;max-width:800px}.hero p{max-width:760px;color:#9ba8b8;font-size:17px;line-height:1.6}.lifecycle{display:flex;gap:8px;flex-wrap:wrap}.lifecycle span{border:1px solid #253246;border-radius:999px;padding:9px 13px;color:#aebbd0;font-size:12px}.grid{max-width:1180px;margin:auto;display:grid;grid-template-columns:1.1fr .9fr;gap:20px}.card{background:#0d1420;border:1px solid #202d40;border-radius:18px;padding:26px;box-shadow:0 16px 50px #0004}.card h2{margin-top:0}.form-card{display:grid;gap:15px}.identity-note{border:1px solid #26364b;border-radius:10px;padding:12px;color:#91a3ba;background:#09101a;font-size:12px;line-height:1.5}label{display:grid;gap:7px;color:#9eacbd;font-size:13px}input,select,textarea{width:100%;box-sizing:border-box;background:#080e17;color:#edf3fa;border:1px solid #29384c;border-radius:10px;padding:12px;font:inherit}textarea{min-height:90px;resize:vertical}button{border:0;border-radius:10px;padding:13px 16px;background:#e9f1ff;color:#07101c;font-weight:800;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.contract{padding:16px 0;border-bottom:1px solid #1e2a3b;display:grid;gap:5px}.contract b{color:#eef3f8}.contract span{color:#93a2b6}.result{margin-top:20px;background:#050910;border:1px solid #1e2b3e;border-radius:10px;padding:14px;overflow:auto;max-height:350px;color:#a9e5bc;font-size:12px}@media(max-width:800px){.builder-shell{padding:22px}.hero,.grid{display:block}.lifecycle{margin-top:20px}.card{margin-bottom:18px}}
      `}</style>
    </main>
  );
}
