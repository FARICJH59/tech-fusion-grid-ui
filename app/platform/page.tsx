import Link from "next/link";
import { hoareEnterprisePlatform } from "@/lib/enterprise/platform";

export default function PlatformPage() {
  const status = hoareEnterprisePlatform.status();
  const modules = hoareEnterprisePlatform.controlPlane.list();

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
      <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>HOARE Enterprise Control Plane</h1>
      <p style={{ color: "#9ca3af", marginBottom: 24 }}>
        Central operating system integrating enterprise governance with HOARE-Agent runtime.
      </p>

      <div style={{ marginBottom: 24 }}>
        <strong>Cloud Project:</strong> {status.cloud.projectId} ({status.cloud.region})
      </div>

      <h2 style={{ marginBottom: 12 }}>Layer 1 Modules</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {modules.map((module) => (
          <div
            key={module.slug}
            style={{
              border: "1px solid #263248",
              borderRadius: 10,
              background: "#162033",
              padding: 12,
            }}
          >
            <h3 style={{ marginTop: 0 }}>{module.name}</h3>
            <p style={{ marginBottom: 0, color: "#a8b3c7" }}>{module.description}</p>
          </div>
        ))}
      </div>

      <h2 style={{ marginBottom: 12 }}>Runtime Services</h2>
      <ul>
        {hoareEnterprisePlatform.runtime.list().map((service) => (
          <li key={service.name}>{service.runtimeName}</li>
        ))}
      </ul>

      <p style={{ marginTop: 20 }}>
        <Link href="/">← Back to dashboard</Link>
      </p>
    </main>
  );
}
