"use client";

import React, { useState } from "react";

type CarbonResult = {
  score: number;
  feasibility: "High" | "Medium" | "Low";
  policyStatus: "Compliant" | "Review Required";
  policyTracking: string[];
  marketSummary: string;
  complianceReport: {
    company: string;
    sector: string;
    projectType: string;
    location: string;
    recommendation: string;
  };
};

export default function CarbonDashboardPage() {
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState("Forestry");
  const [projectType, setProjectType] = useState("REDD+");
  const [location, setLocation] = useState("Ghana");
  const [sessionId, setSessionId] = useState("carbon-anon");
  const [result, setResult] = useState<CarbonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);

    const normalized = company.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const nextSessionId = `carbon-${normalized || "anon"}`;
    setSessionId(nextSessionId);

    try {
      const res = await fetch("/api/carbon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: nextSessionId,
          payload: { company, sector, projectType, location },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Carbon analysis failed");
        setResult(null);
      } else {
        setResult((data.result ?? null) as CarbonResult | null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Carbon analysis failed";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#fff",
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>
        Carbon Credit Compliance
      </h1>
      <p style={{ color: "#9ca3af", marginBottom: 24 }}>
        Policy tracking, feasibility scoring, and market dashboards.
      </p>

      <section
        style={{
          background: "#162033",
          border: "1px solid #263248",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Project Submission Workflow</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <input
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            style={{ padding: 10, borderRadius: 8 }}
          />
          <input
            placeholder="Sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            style={{ padding: 10, borderRadius: 8 }}
          />
          <input
            placeholder="Project Type"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            style={{ padding: 10, borderRadius: 8 }}
          />
          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ padding: 10, borderRadius: 8 }}
          />
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Running analysis..." : "Run analysis"}
        </button>
        <p style={{ color: "#9ca3af", marginTop: 10, marginBottom: 0 }}>
          Session: {sessionId}
        </p>
        {error && (
          <p style={{ color: "#f87171", marginTop: 10, marginBottom: 0 }}>
            {error}
          </p>
        )}
      </section>

      <section
        style={{
          background: "#162033",
          border: "1px solid #263248",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Compliance Report Generator</h2>
        {!result ? (
          <p style={{ color: "#9ca3af", marginBottom: 0 }}>
            Run analysis to render a structured compliance report.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0 }}>
              <strong>Feasibility Score:</strong> {result.score}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Feasibility:</strong> {result.feasibility}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Policy Status:</strong> {result.policyStatus}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Market Summary:</strong> {result.marketSummary}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Policy Tracking:</strong>
            </p>
            <ul style={{ marginTop: 0 }}>
              {result.policyTracking.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p style={{ margin: 0 }}>
              <strong>Recommendation:</strong>{" "}
              {result.complianceReport.recommendation}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
