"use client";

import { useEffect, useState } from "react";

type FleetMetric = {
  region: string;
  agent: string;
  avg_latency: number;
  health: string;
  failover: boolean;
};

type FleetData = {
  regions: string[];
  metrics: FleetMetric[];
};

const HEALTH_COLOR: Record<string, string> = {
  healthy: "#34d399",
  degraded: "#fbbf24",
  critical: "#f87171",
};

function healthColor(health: string): string {
  return HEALTH_COLOR[health.toLowerCase()] ?? "#9ca3af";
}

export default function GlobalFleetMatrix() {
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_HOARE_API_URL}/api/fleet/status`
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const json: FleetData = await res.json();

        if (isMounted) {
          setData(json);
          setActiveRegion(json.regions[0] ?? null);
        }
      } catch (err) {
        console.error("Fleet fetch error:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      }

      if (isMounted) setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0b1220",
          color: "#9ca3af",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p>Loading fleet matrix…</p>
      </main>
    );
  }

  if (error || !data) {
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
        <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Global Fleet Matrix</h1>
        <div
          style={{
            border: "1px solid #7f1d1d",
            background: "#2b1010",
            color: "#fecaca",
            borderRadius: 8,
            padding: 12,
            marginTop: 16,
          }}
        >
          Failed to load fleet data: {error ?? "No data returned"}
        </div>
      </main>
    );
  }

  const visibleMetrics =
    activeRegion != null
      ? data.metrics.filter((m) => m.region === activeRegion)
      : data.metrics;

  const healthCounts = data.metrics.reduce<Record<string, number>>(
    (acc, m) => {
      const key = m.health.toLowerCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {}
  );

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
      <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Global Fleet Matrix</h1>
      <p style={{ color: "#9ca3af", marginBottom: 24 }}>
        Real-time agent health across all regions.
      </p>

      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {Object.entries(healthCounts).map(([status, count]) => (
          <div
            key={status}
            style={{
              background: "#111827",
              border: `1px solid ${healthColor(status)}44`,
              borderRadius: 8,
              padding: "10px 18px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: healthColor(status),
                display: "inline-block",
              }}
            />
            <span style={{ textTransform: "capitalize", fontSize: 14 }}>
              {status}
            </span>
            <strong style={{ color: healthColor(status) }}>{count}</strong>
          </div>
        ))}
      </div>

      {/* Region tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button
          onClick={() => setActiveRegion(null)}
          style={{
            background: activeRegion === null ? "#1e3a5f" : "#162033",
            border: `1px solid ${activeRegion === null ? "#3b82f6" : "#263248"}`,
            color: activeRegion === null ? "#93c5fd" : "#9ca3af",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          All
        </button>
        {data.regions.map((region) => (
          <button
            key={region}
            onClick={() => setActiveRegion(region)}
            style={{
              background: activeRegion === region ? "#1e3a5f" : "#162033",
              border: `1px solid ${activeRegion === region ? "#3b82f6" : "#263248"}`,
              color: activeRegion === region ? "#93c5fd" : "#9ca3af",
              borderRadius: 6,
              padding: "6px 14px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {region}
          </button>
        ))}
      </div>

      {/* Metrics table */}
      {visibleMetrics.length === 0 ? (
        <p style={{ color: "#9ca3af" }}>No agents found for the selected region.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#111827",
                  textAlign: "left",
                  color: "#9ca3af",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #263248" }}>Region</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #263248" }}>Agent</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #263248" }}>Avg Latency (ms)</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #263248" }}>Health</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #263248" }}>Failover</th>
              </tr>
            </thead>
            <tbody>
              {visibleMetrics.map((metric, idx) => (
                <tr
                  key={`${metric.region}-${metric.agent}-${idx}`}
                  style={{
                    background: idx % 2 === 0 ? "#0f172a" : "#0b1220",
                    borderBottom: "1px solid #1f2937",
                  }}
                >
                  <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>{metric.region}</td>
                  <td style={{ padding: "10px 14px" }}>{metric.agent}</td>
                  <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>
                    {metric.avg_latency.toFixed(1)}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        color: healthColor(metric.health),
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {metric.health}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        background: metric.failover ? "#1f2937" : "transparent",
                        border: `1px solid ${metric.failover ? "#fbbf24" : "#263248"}`,
                        color: metric.failover ? "#fbbf24" : "#6b7280",
                        borderRadius: 9999,
                        padding: "2px 10px",
                        fontSize: 12,
                      }}
                    >
                      {metric.failover ? "Active" : "Standby"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
