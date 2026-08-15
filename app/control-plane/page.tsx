"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const modules = [
  { id: "agents", label: "Agent Builder", icon: "◈", description: "Create, configure and govern autonomous agents." },
  { id: "workflows", label: "Workflow Builder", icon: "⌁", description: "Compose governed workflows from agents, tools and events." },
  { id: "tenants", label: "Tenants", icon: "▦", description: "Provision isolated tenant environments and runtime identities." },
  { id: "identity", label: "Identity & IAM", icon: "◇", description: "Manage identity, roles, permissions and access policies." },
  { id: "policies", label: "Policy Center", icon: "◉", description: "Define runtime, security and tenant governance policies." },
  { id: "runtime", label: "Runtime", icon: "▶", description: "Observe execution, health, scaling and remediation." },
  { id: "deployments", label: "Deployments", icon: "⇧", description: "Package and deploy workloads across supported runtimes." },
  { id: "billing", label: "Metering & Billing", icon: "$", description: "Track usage, entitlements and revenue events." },
];

const activity = [
  ["POLICY", "Tenant isolation policy verified", "2m ago"],
  ["AGENT", "Shelf Scouter runtime healthy", "4m ago"],
  ["RUNTIME", "Edge gateway heartbeat received", "7m ago"],
  ["TENANT", "Provisioning capability available", "11m ago"],
];

export default function ControlPlanePage() {
  const [selected, setSelected] = useState("agents");
  const selectedModule = useMemo(() => modules.find((m) => m.id === selected)!, [selected]);

  return (
    <main style={{ minHeight: "100vh", background: "#07101f", color: "#e8eef8", fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: "10px 4px 28px" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, color: "#7dd3fc", fontWeight: 700 }}>TECH FUSION / HOARE</div>
            <h1 style={{ margin: "8px 0 4px", fontSize: 32 }}>HOARE Control Plane</h1>
            <p style={{ margin: 0, color: "#8fa2bd" }}>The builder and governance surface for the autonomous platform.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/" style={buttonStyle}>Overview</Link>
            <span style={{ ...buttonStyle, background: "#123b32", color: "#7ee2b8", borderColor: "#1e6b57" }}>● SYSTEM ONLINE</span>
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginBottom: 24 }}>
          {[["42", "Tenants"], ["24", "Active agents"], ["99.98%", "Runtime health"], ["18.7K", "Events / sec"]].map(([value, label]) => (
            <div key={label} style={cardStyle}>
              <div style={{ color: "#7186a3", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 750, marginTop: 8 }}>{value}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 18 }}>
          <aside style={{ ...cardStyle, padding: 12 }}>
            <div style={{ padding: "8px 10px 14px", color: "#7186a3", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Builder modules</div>
            {modules.map((module) => (
              <button key={module.id} onClick={() => setSelected(module.id)} style={{ width: "100%", textAlign: "left", border: 0, borderRadius: 10, padding: "12px 10px", marginBottom: 4, background: selected === module.id ? "#132a45" : "transparent", color: selected === module.id ? "#e8eef8" : "#9eb0c8", cursor: "pointer" }}>
                <span style={{ display: "inline-block", width: 28, color: "#7dd3fc", fontWeight: 700 }}>{module.icon}</span>
                {module.label}
              </button>
            ))}
          </aside>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ ...cardStyle, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: "#7dd3fc", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>Builder workspace</div>
                  <h2 style={{ margin: "8px 0 8px", fontSize: 25 }}>{selectedModule.label}</h2>
                  <p style={{ margin: 0, color: "#93a6c0", maxWidth: 700 }}>{selectedModule.description}</p>
                </div>
                <button style={{ ...buttonStyle, background: "#0e7490", borderColor: "#0891b2", color: "white", cursor: "pointer" }}>+ Create</button>
              </div>

              <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                {["Design", "Govern", "Deploy"].map((step, index) => (
                  <div key={step} style={{ border: "1px solid #1b2b43", borderRadius: 12, padding: 16, background: "#0b1729" }}>
                    <div style={{ color: "#55708f", fontSize: 12 }}>0{index + 1}</div>
                    <strong style={{ display: "block", marginTop: 7 }}>{step}</strong>
                    <span style={{ display: "block", marginTop: 5, color: "#7f93ae", fontSize: 13 }}>{index === 0 ? "Define the resource" : index === 1 ? "Apply identity and policy" : "Promote to runtime"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 22 }}>
              <h3 style={{ marginTop: 0 }}>Control-plane activity</h3>
              <div style={{ display: "grid", gap: 1, background: "#1b2b43" }}>
                {activity.map(([type, message, time]) => (
                  <div key={message} style={{ background: "#0b1729", padding: "13px 15px", display: "grid", gridTemplateColumns: "90px 1fr 70px", gap: 10 }}>
                    <span style={{ color: "#7dd3fc", fontSize: 11, fontWeight: 700 }}>{type}</span>
                    <span>{message}</span>
                    <span style={{ color: "#647b98", textAlign: "right", fontSize: 12 }}>{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer style={{ marginTop: 24, padding: 14, color: "#627894", fontSize: 12, borderTop: "1px solid #16263c" }}>
          HOARE is the control layer. Cloud, edge, identity, model and infrastructure providers are execution targets—not the builder.
        </footer>
      </div>
    </main>
  );
}

const cardStyle = { background: "#0d1a2c", border: "1px solid #1b2b43", borderRadius: 14, boxSizing: "border-box" as const };
const buttonStyle = { border: "1px solid #243955", borderRadius: 9, padding: "9px 12px", color: "#b8c7da", textDecoration: "none", background: "#0d1a2c", fontSize: 13 };
