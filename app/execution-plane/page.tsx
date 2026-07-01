"use client";

import { useEffect, useState } from "react";
import { mqttClient } from "@/lib/mqtt";

export default function ExecutionPlanePage() {
  const [inverters, setInverters] = useState({});
  const [faults, setFaults] = useState([]);

  useEffect(() => {
    mqttClient.subscribe("edge/inverters/#");
    mqttClient.subscribe("edge/faults");

    mqttClient.on("message", (topic, msg) => {
      if (topic.startsWith("edge/inverters/")) {
        const id = topic.split("/")[2];
        setInverters((prev) => ({ ...prev, [id]: msg.toString() }));
      }

      if (topic === "edge/faults") {
        setFaults((prev) => [...prev, msg.toString()]);
      }
    });
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
