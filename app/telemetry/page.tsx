"use client";

import { useEffect, useMemo, useState } from "react";
import GridPipelineCanvas, { type TelemetrySnapshot } from "@/components/GridPipelineCanvas";

const WS_RECONNECT_DELAY_MS = 3000;

const DEFAULT_TELEMETRY: TelemetrySnapshot = {
  triton: { latency: 12, queueDepth: 3, tps: 100 },
  z3: { latency: 20, queueDepth: 1, isSolving: false },
  commit: { latency: 5, queueDepth: 0 },
};

const telemetryEquals = (a: TelemetrySnapshot, b: TelemetrySnapshot) =>
  a.triton.latency === b.triton.latency &&
  a.triton.queueDepth === b.triton.queueDepth &&
  a.triton.tps === b.triton.tps &&
  a.z3.latency === b.z3.latency &&
  a.z3.queueDepth === b.z3.queueDepth &&
  a.z3.isSolving === b.z3.isSolving &&
  a.commit.latency === b.commit.latency &&
  a.commit.queueDepth === b.commit.queueDepth;

const asTelemetrySnapshot = (value: unknown): TelemetrySnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const input = value as TelemetrySnapshot;

  if (
    typeof input.triton?.latency !== "number" ||
    typeof input.triton?.queueDepth !== "number" ||
    typeof input.triton?.tps !== "number" ||
    typeof input.z3?.latency !== "number" ||
    typeof input.z3?.queueDepth !== "number" ||
    typeof input.z3?.isSolving !== "boolean" ||
    typeof input.commit?.latency !== "number" ||
    typeof input.commit?.queueDepth !== "number"
  ) {
    return null;
  }

  return input;
};

export default function TelemetryPage() {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(DEFAULT_TELEMETRY);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [streamError, setStreamError] = useState<string | null>(null);
  const wsUrl = useMemo(
    () => process.env.NEXT_PUBLIC_TELEMETRY_WS_URL ?? "ws://localhost:1884/telemetry",
    [],
  );

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isActive = true;

    const scheduleReconnect = () => {
      if (!isActive || reconnectTimer) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, WS_RECONNECT_DELAY_MS);
    };

    const connect = () => {
      if (!isActive) {
        return;
      }

      try {
        setConnectionStatus("connecting");
        ws = new WebSocket(wsUrl);
      } catch {
        setConnectionStatus("disconnected");
        setStreamError("Failed to initialize telemetry socket.");
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        setConnectionStatus("connected");
        setStreamError(null);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as unknown;
          const next = asTelemetrySnapshot(parsed);
          if (!next) {
            setStreamError("Malformed telemetry payload ignored.");
            return;
          }
          setTelemetry((previous) => (telemetryEquals(previous, next) ? previous : next));
          setStreamError(null);
        } catch {
          setStreamError("Telemetry message parsing failed.");
        }
      };

      ws.onerror = () => {
        setStreamError("Telemetry socket error.");
      };

      ws.onclose = () => {
        if (!isActive) {
          return;
        }
        setConnectionStatus("disconnected");
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      isActive = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [wsUrl]);

  return (
    <section className="grid grid-cols-1 gap-6">
      <p>
        Telemetry Socket: <strong>{connectionStatus}</strong>
      </p>
      {streamError && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {streamError}
        </p>
      )}
      <GridPipelineCanvas telemetry={telemetry} />
    </section>
  );
}
