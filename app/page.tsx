"use client";

import React from "react";
import Link from "next/link";

const sections = [
  {
    id: "overview",
    title: "HOARE DevOps OS",
    subtitle:
      "Cloud‑agnostic agentic operating system for multi‑industry software creation, verification, and deployment.",
    body: `Tech Fusion Grid UI, HOARE‑AI, and HOARE‑AGENT form a three‑layer DevOps OS that can build, verify, deploy, and operate projects across industries — with agentic automation and provable correctness.`,
  },
  {
    id: "architecture",
    title: "Three‑Layer Architecture",
    subtitle: "Control plane, agent runtime, verification engine.",
    body: `Layer 1 — Tech Fusion Grid UI: multi‑tenant control plane, billing, access matrix, SaaS panels, ML Scaffolder, HOARE Use Case Panel.
Layer 2 — HOARE‑AI: agent runtime, tools, multi‑agent swarm, quantum, ML, robotics, finance, DevOps automation.
Layer 3 — HOARE‑AGENT: formal verification, Z3 SMT, PDA grammar, schema registry, proof‑gated deployment.`,
  },
  {
    id: "cloud",
    title: "Cloud‑Agnostic by Design",
    subtitle: "Run anywhere. No vendor lock‑in.",
    body: `HOARE DevOps OS runs on AWS, GCP, Azure, Fly.io, Railway, Render, edge Pi‑5 clusters, and Vercel for UI. Backend services are portable, and the control plane orchestrates deployments without tying you to a single provider.`,
  },
  {
    id: "industries",
    title: "Built for All Industries",
    subtitle: "Energy, finance, robotics, healthcare, manufacturing, SaaS, and more.",
    body: `Energy: DR optimization, grid telemetry, battery sizing, sustainability audit.
Finance: risk dashboards, ledgers, portfolio optimization, compliance.
Robotics: sensor telemetry, control loops, path planning, fleet management.
Healthcare: patient telemetry, ML diagnostics, compliance audit.
Manufacturing & SaaS: IoT ingestion, predictive maintenance, CRUD admin, auth, billing, API explorer.`,
  },
  {
    id: "whitepaper",
    title: "Whitepaper",
    subtitle: "HOARE DevOps OS — 2026 Edition.",
    body: `This platform is a cloud‑agnostic agentic operating system for building, verifying, and deploying software across industries. It replaces manual coding and DevOps with agentic scaffolding, deployment, repair, verification, and multi‑cloud orchestration.`,
  },
];

const metrics = [
  { title: "Active Agents", value: "24" },
  { title: "IoT Devices", value: "1,284" },
  { title: "Events / sec", value: "18.7K" },
  { title: "Anomalies", value: "3" },
  { title: "Runtime Health", value: "99.98%" },
  { title: "Tenants", value: "42" },
];

export default function HomePage() {
  const [active, setActive] = React.useState("overview");

  const current = sections.find((s) => s.id === active) ?? sections[0];

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
      {/* ── Header ── */}
      <h1 style={{ fontSize: "2.5rem", marginBottom: 8 }}>
        Tech Fusion Foundary
      </h1>
      <p style={{ color: "#9ca3af", marginBottom: 32 }}>
        Enterprise Autonomous AI + IoT Control Plane
      </p>

      {/* ── HOARE DevOps OS — tabbed info panel ── */}
      <section style={{ marginBottom: 40 }}>
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 0,
          }}
        >
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                padding: "8px 18px",
                borderRadius: "8px 8px 0 0",
                border: "1px solid #263248",
                borderBottom: active === s.id ? "1px solid #162033" : "1px solid #263248",
                background: active === s.id ? "#162033" : "#0d1a2d",
                color: active === s.id ? "#60a5fa" : "#9ca3af",
                fontWeight: active === s.id ? 700 : 400,
                cursor: "pointer",
                fontSize: "0.85rem",
                letterSpacing: "0.03em",
                transition: "color 0.15s",
              }}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Panel body */}
        <div
          style={{
            background: "#162033",
            border: "1px solid #263248",
            borderRadius: "0 8px 8px 8px",
            padding: "28px 32px",
          }}
        >
          <h2 style={{ fontSize: "1.6rem", marginBottom: 6 }}>{current.title}</h2>
          <p style={{ color: "#60a5fa", marginBottom: 16, fontStyle: "italic" }}>
            {current.subtitle}
          </p>
          <p
            style={{
              color: "#d1d5db",
              lineHeight: 1.75,
              whiteSpace: "pre-line",
            }}
          >
            {current.body}
          </p>
        </div>
      </section>

      {/* ── Live Metrics ── */}
      <h2 style={{ marginBottom: 20 }}>Live Platform Metrics</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
          marginBottom: 40,
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.title}
            style={{
              background: "#162033",
              padding: 20,
              borderRadius: 12,
              border: "1px solid #263248",
            }}
          >
            <h3 style={{ color: "#9ca3af", marginBottom: 4 }}>{metric.title}</h3>
            <h2 style={{ fontSize: "1.8rem" }}>{metric.value}</h2>
          </div>
        ))}
      </div>

      {/* ── Platform Modules ── */}
      <h2 style={{ marginBottom: 20 }}>Platform Modules</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
        }}
      >
        <Link href="/telemetry" style={{ color: "#60a5fa", textDecoration: "none" }}>📡 Telemetry</Link>
        <Link href="/execution-plane" style={{ color: "#60a5fa", textDecoration: "none" }}>⚙️ Execution Plane</Link>
        <Link href="/audit" style={{ color: "#60a5fa", textDecoration: "none" }}>🛡 Audit Center</Link>
      </div>
    </main>
  );
}
