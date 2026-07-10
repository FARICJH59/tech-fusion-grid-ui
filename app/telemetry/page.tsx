"use client";

import { useEffect, useMemo, useState } from "react";
import GridPipelineCanvas, { type TelemetrySnapshot } from "@/components/GridPipelineCanvas";
import {
  DEFAULT_TELEMETRY,
  asTelemetrySnapshot,
  createTelemetryRuntime,
  telemetryEquals,
  type TelemetrySocket,
  type TelemetryStatus,
} from "@/lib/telemetry/runtime";

const WS_RECONNECT_DELAY_MS = 3000;

export default function TelemetryPage() {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(DEFAULT_TELEMETRY);
  const [connectionStatus, setConnectionStatus] = useState<TelemetryStatus>("disconnected");
  const [streamError, setStreamError] = useState<string | null>(null);
  const wsUrl = useMemo(
    () => process.env.NEXT_PUBLIC_TELEMETRY_WS_URL ?? "ws://localhost:1884/telemetry",
    [],
  );

  useEffect(() => {
    const runtime = createTelemetryRuntime({
      url: wsUrl,
      reconnectDelayMs: WS_RECONNECT_DELAY_MS,
      socketFactory: (url) => new WebSocket(url) as unknown as TelemetrySocket,
      scheduleReconnect: (callback, delayMs) => setTimeout(callback, delayMs),
      cancelReconnect: (timer) => clearTimeout(timer),
      onStatus: setConnectionStatus,
      onError: setStreamError,
      onTelemetry: setTelemetry,
      telemetryEquals,
      parseTelemetry: asTelemetrySnapshot,
      initialTelemetry: DEFAULT_TELEMETRY,
    });
    runtime.start();

    return () => {
      runtime.stop();
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
