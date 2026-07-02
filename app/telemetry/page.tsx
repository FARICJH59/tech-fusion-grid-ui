'use client';

import React, { useState, useEffect } from 'react';
import GridPipelineCanvas from '@/components/GridPipelineCanvas';

type TelemetryData = {
  triton: { latency: number; queueDepth: number; tps: number };
  z3: { latency: number; queueDepth: number; isSolving: boolean };
  commit: { latency: number; queueDepth: number };
};

const GridPipelineCanvasWithTypedTelemetry =
  GridPipelineCanvas as unknown as React.ComponentType<{ telemetry: TelemetryData }>;

function GridPipelineCanvasWithTelemetry({ telemetry }: { telemetry: TelemetryData }) {
  return <GridPipelineCanvasWithTypedTelemetry telemetry={telemetry} />;
}

export default function TelemetryPage() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    triton: { latency: 0, queueDepth: 0, tps: 0 },
    z3: { latency: 0, queueDepth: 0, isSolving: false },
    commit: { latency: 0, queueDepth: 0 },
  });
  const [status, setStatus] = useState('DISCONNECTED');

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_TELEMETRY_URL || 'ws://127.0.0.1:8765';
    const ws = new WebSocket(socketUrl);

    ws.onopen = () => setStatus('CONNECTED');
    ws.onmessage = (event) => {
      try {
        setTelemetry(JSON.parse(event.data) as TelemetryData);
      } catch (err) {
        console.error('Failed to parse telemetry frame:', err);
      }
    };
    ws.onclose = () => setStatus('DISCONNECTED');
    ws.onerror = () => setStatus('ERROR');

    return () => ws.close();
  }, []);

  const mw = telemetry.triton.tps ? Math.round(telemetry.triton.tps * 0.08) : null;
  const queueDepth = telemetry.z3.queueDepth || telemetry.triton.queueDepth;
  const workerLoad = telemetry.triton.tps ? Math.min(100, Math.round((telemetry.triton.tps / 2000) * 100)) : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex flex-col gap-6">
      <header className="border-b border-zinc-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-tight text-white">AESIRGRID // TELEMETRY</h1>
          <p className="text-sm text-zinc-400 font-mono mt-1">TechFusion Core Fabric Real-time Operations</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs px-3 py-1 rounded border border-zinc-800 bg-zinc-900/50">
          <span className={`w-2 h-2 rounded-full ${status === 'CONNECTED' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
          <span className="text-zinc-400">DAEMON: {status}</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6">
        <GridPipelineCanvasWithTelemetry telemetry={telemetry} />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <section className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-lg">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Power Flow</h2>
          <p className="text-xl font-bold text-amber-400 mt-1">
            {mw !== null ? `${mw} MW` : "— MW"}
          </p>
        </section>

        <section className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-lg">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Queue Depth</h2>
          <p className="text-xl font-bold text-zinc-100 mt-1">
            {queueDepth ?? "—"}
          </p>
        </section>

        <section className="border border-zinc-800 bg-zinc-900/30 p-4 rounded-lg">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Worker Fleet Load</h2>
          <p className="text-xl font-bold text-purple-400 mt-1">
            {workerLoad !== null ? `${workerLoad}%` : "— %"}
          </p>
        </section>
      </div>
    </main>
  );
}
