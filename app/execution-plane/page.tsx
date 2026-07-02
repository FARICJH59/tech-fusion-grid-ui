"use client";

import { useEffect, useState } from "react";
import { mqttClient } from "@/lib/mqtt";

type InvertersState = Record<string, string>;

export default function ExecutionPlanePage() {
  const [inverters, setInverters] = useState<InvertersState>({});
  const [faults, setFaults] = useState<string[]>([]);

  useEffect(() => {
    mqttClient.subscribe("edge/inverters/#");
    mqttClient.subscribe("edge/faults");
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="border border-slate-800 rounded-lg p-4">
        <h2>Inverter Sync Matrix</h2>
        <pre className="text-xs">{JSON.stringify(inverters, null, 2)}</pre>
      </section>

      <section className="border border-slate-800 rounded-lg p-4">
        <h2>Fault Stream</h2>
        <pre className="text-xs">{JSON.stringify(faults, null, 2)}</pre>
      </section>
    </div>
  );
}
