"use client";

import { useEffect, useState } from "react";

type Deployment = {
  id: string;
  projectId: string;
  name: string;
  target: string;
  status: string;
  version: string;
  region: string;
  frontendEndpoint?: string;
  backendEndpoint?: string;
};

export default function HoareDeploymentsPage() {
  const [tenantId, setTenantId] = useState("");
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!tenantId) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/hoare/deployments", {
        headers: { "x-tenant-id": tenantId },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load deployments");
      setDeployments(payload.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load deployments");
    } finally {
      setBusy(false);
    }
  }

  async function createDeployment() {
    if (!tenantId) return setMessage("Enter a tenant ID first.");
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/hoare/deployments", {
        method: "POST",
        headers: { "content-type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({
          projectId: "hoare-generated-project",
          name: "HOARE generated full-stack application",
          target: "full-stack",
          version: "v1",
          region: "local",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create deployment");
      setDeployments((current) => [payload.data, ...current]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create deployment");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/hoare/deployments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update deployment");
      setDeployments((current) => current.map((item) => item.id === id ? payload.data : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update deployment");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("hoare.tenantId") ?? "";
    setTenantId(saved);
  }, []);

  function saveTenant(value: string) {
    setTenantId(value);
    window.localStorage.setItem("hoare.tenantId", value);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>HOARE Deployments</h1>
      <p>Native deployment control plane: Build → Deploy → Observe → Stop → Restart.</p>

      <section style={{ display: "flex", gap: 12, margin: "24px 0" }}>
        <input
          value={tenantId}
          onChange={(event) => saveTenant(event.target.value)}
          placeholder="Tenant ID"
          aria-label="Tenant ID"
          style={{ flex: 1, padding: 10 }}
        />
        <button disabled={busy || !tenantId} onClick={load}>Refresh</button>
        <button disabled={busy || !tenantId} onClick={createDeployment}>Build deployment</button>
      </section>

      {message && <p role="alert">{message}</p>}

      <section>
        {deployments.length === 0 ? <p>No deployments recorded for this tenant.</p> : deployments.map((deployment) => (
          <article key={deployment.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 18, marginBottom: 12 }}>
            <strong>{deployment.name}</strong>
            <div>{deployment.target} · {deployment.version} · {deployment.region}</div>
            <div>Status: <strong>{deployment.status}</strong></div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button disabled={busy} onClick={() => setStatus(deployment.id, "building")}>Build</button>
              <button disabled={busy} onClick={() => setStatus(deployment.id, "running")}>Deploy / Run</button>
              <button disabled={busy} onClick={() => setStatus(deployment.id, "stopped")}>Stop</button>
              <button disabled={busy} onClick={() => setStatus(deployment.id, "failed")}>Mark failed</button>
            </div>
            {deployment.frontendEndpoint && <div>Frontend: {deployment.frontendEndpoint}</div>}
            {deployment.backendEndpoint && <div>Backend: {deployment.backendEndpoint}</div>}
          </article>
        ))}
      </section>
    </main>
  );
}
