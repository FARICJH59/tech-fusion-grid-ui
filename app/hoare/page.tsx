import Link from "next/link";

export default function HoarePage() {
  const modules = [
    { href: "/hoare/chat", label: "💬 Chat", description: "Converse with HOARE AI" },
    { href: "/hoare/tools", label: "🔧 Tools", description: "Browse and invoke agent tools" },
    { href: "/hoare/dashboard", label: "📊 Dashboard", description: "Session metrics and activity" },
  ];

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
      <h1 style={{ fontSize: "2.5rem", marginBottom: 8 }}>HOARE AI</h1>
      <p style={{ color: "#9ca3af", marginBottom: 32 }}>
        Autonomous AI Agent — Tech Fusion Foundry Control Plane
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
        }}
      >
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            style={{
              background: "#162033",
              padding: 24,
              borderRadius: 12,
              border: "1px solid #263248",
              textDecoration: "none",
              color: "#fff",
              display: "block",
            }}
          >
            <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>{m.label}</div>
            <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
              {m.description}
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        <Link href="/" style={{ color: "#6366f1" }}>
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
