import Link from "next/link";

const surfaces = [
  ["Agent Builder", "Design and govern autonomous agents."],
  ["Workflow Builder", "Compose agents, tools and events."],
  ["Identity & IAM", "Manage tenants, roles and permissions."],
  ["Policy Center", "Apply runtime and security governance."],
  ["Runtime", "Observe execution and remediation."],
  ["Deployments", "Promote workloads to execution targets."],
];

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#07101f", color: "#e8eef8", padding: 32, fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ color: "#7dd3fc", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>TECH FUSION / HOARE</div>
        <h1 style={{ fontSize: 44, margin: "12px 0 8px" }}>Autonomous Platform Builder</h1>
        <p style={{ color: "#8fa2bd", fontSize: 18, maxWidth: 760 }}>
          HOARE provides the control plane for building, governing and operating autonomous AI, IoT and edge systems.
        </p>

        <Link href="/control-plane" style={{ display: "inline-block", margin: "20px 0 36px", padding: "13px 18px", borderRadius: 10, background: "#0e7490", color: "white", textDecoration: "none", fontWeight: 700 }}>
          Open HOARE Control Plane →
        </Link>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
          {surfaces.map(([title, description]) => (
            <div key={title} style={{ background: "#0d1a2c", border: "1px solid #1b2b43", borderRadius: 14, padding: 20 }}>
              <h2 style={{ fontSize: 18, marginTop: 0 }}>{title}</h2>
              <p style={{ color: "#8398b3", lineHeight: 1.5 }}>{description}</p>
            </div>
          ))}
        </section>

        <div style={{ marginTop: 36, paddingTop: 18, borderTop: "1px solid #16263c", color: "#627894", fontSize: 13 }}>
          Providers are execution targets. HOARE remains the control, governance and builder layer.
        </div>
      </div>
    </main>
  );
}
