type Telemetry = {
  triton: {
    latency: number;
    queueDepth: number;
    tps: number;
  };
  z3: {
    latency: number;
    queueDepth: number;
    isSolving: boolean;
  };
  commit: {
    latency: number;
    queueDepth: number;
  };
};

export default function GridPipelineCanvas({
  telemetry,
}: {
  telemetry: Telemetry;
}) {
  return (
    <div>
      <h2>Grid Pipeline Canvas</h2>
      <pre>{JSON.stringify(telemetry, null, 2)}</pre>
    </div>
  );
}
