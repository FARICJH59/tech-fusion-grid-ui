"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type TelemetryRecord = {
  id: string;
  timestamp: string;
  event: string;
  agent: string | null;
  metadata: JsonValue;
  payload: JsonValue;
};

export default function TelemetryPage() {
  const { supabase, user } = useSupabase();
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTelemetry = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("telemetry_events")
        .select("id,timestamp,event,agent,metadata,payload")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (!isMounted) return;

      if (queryError) {
        setError(queryError.message);
        setRecords([]);
      } else {
        setRecords((data ?? []) as TelemetryRecord[]);
      }

      setLoading(false);
    };

    loadTelemetry();

    return () => {
      isMounted = false;
    };
  }, [supabase, user?.id]);

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
      <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Telemetry</h1>
      <p style={{ color: "#9ca3af", marginBottom: 24 }}>
        Recent telemetry events from Supabase.
      </p>

      {loading && <p style={{ color: "#9ca3af" }}>Loading telemetry…</p>}

      {!loading && error && (
        <div
          style={{
            border: "1px solid #7f1d1d",
            background: "#2b1010",
            color: "#fecaca",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          Failed to load telemetry: {error}
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <p style={{ color: "#9ca3af" }}>No telemetry records found.</p>
      )}

      {!loading && !error && records.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {records.map((record) => (
            <article
              key={record.id}
              style={{
                background: "#111827",
                border: "1px solid #263248",
                borderRadius: 12,
                padding: 16,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <strong>{record.event}</strong>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>
                  {new Date(record.timestamp).toLocaleString()}
                </span>
                <span
                  style={{
                    background: "#1f2937",
                    border: "1px solid #334155",
                    borderRadius: 9999,
                    padding: "2px 10px",
                    fontSize: 12,
                    color: "#cbd5e1",
                  }}
                >
                  Agent: {record.agent ?? "unknown"}
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>Metadata</div>
                  <pre
                    style={{
                      margin: 0,
                      background: "#0b1220",
                      border: "1px solid #1f2937",
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 12,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(record.metadata, null, 2)}
                  </pre>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>Payload</div>
                  <pre
                    style={{
                      margin: 0,
                      background: "#0b1220",
                      border: "1px solid #1f2937",
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 12,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(record.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
