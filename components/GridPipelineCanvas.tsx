import { memo, useMemo } from "react";

type TelemetryStage = {
  latency: number;
  queueDepth: number;
};

export type TelemetrySnapshot = {
  triton: {
    latency: number;
    queueDepth: number;
    tps: number;
  };
  z3: TelemetryStage & { isSolving: boolean };
  commit: TelemetryStage;
};

const EMPTY_TELEMETRY: TelemetrySnapshot = {
  triton: { latency: 0, queueDepth: 0, tps: 0 },
  z3: { latency: 0, queueDepth: 0, isSolving: false },
  commit: { latency: 0, queueDepth: 0 },
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeTelemetry = (telemetry: unknown): TelemetrySnapshot => {
  if (!telemetry || typeof telemetry !== "object") {
    return EMPTY_TELEMETRY;
  }

  const input = telemetry as Partial<TelemetrySnapshot>;
  const triton = input.triton;
  const z3 = input.z3;
  const commit = input.commit;

  return {
    triton: {
      latency: isFiniteNumber(triton?.latency) ? triton.latency : 0,
      queueDepth: isFiniteNumber(triton?.queueDepth) ? triton.queueDepth : 0,
      tps: isFiniteNumber(triton?.tps) ? triton.tps : 0,
    },
    z3: {
      latency: isFiniteNumber(z3?.latency) ? z3.latency : 0,
      queueDepth: isFiniteNumber(z3?.queueDepth) ? z3.queueDepth : 0,
      isSolving: typeof z3?.isSolving === "boolean" ? z3.isSolving : false,
    },
    commit: {
      latency: isFiniteNumber(commit?.latency) ? commit.latency : 0,
      queueDepth: isFiniteNumber(commit?.queueDepth) ? commit.queueDepth : 0,
    },
  };
};

type GridPipelineCanvasProps = {
  telemetry?: TelemetrySnapshot | null;
};

function GridPipelineCanvas({ telemetry }: GridPipelineCanvasProps) {
  const safeTelemetry = useMemo(() => normalizeTelemetry(telemetry), [telemetry]);
  const serialized = useMemo(() => JSON.stringify(safeTelemetry, null, 2), [safeTelemetry]);

  return (
    <div>
      <h2>Grid Pipeline Canvas</h2>
      <pre>{serialized}</pre>
    </div>
  );
}

export default memo(GridPipelineCanvas);
