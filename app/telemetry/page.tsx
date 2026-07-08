import GridPipelineCanvas from "@/components/GridPipelineCanvas";

const telemetry = {
  triton: {
    latency: 12,
    queueDepth: 3,
    tps: 100,
  },
  z3: {
    latency: 20,
    queueDepth: 1,
    isSolving: false,
  },
  commit: {
    latency: 5,
    queueDepth: 0,
  },
};

export default function TelemetryPage() {
  return (
    <section className="grid grid-cols-1 gap-6">
      <GridPipelineCanvas telemetry={telemetry} />
    </section>
  );
}
