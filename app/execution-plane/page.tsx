"use client";

import { useEffect, useState } from "react";
import { mqttClient } from "@/lib/mqtt";

type InverterState = Record<string, any>;

export default function ExecutionPlanePage() {
  const [inverters, setInverters] = useState<InverterState>({});
  const [faults, setFaults] = useState<string[]>([]);

  useEffect(() => {
    mqttClient.subscribe("edge/inverters/#");
    mqttClient.subscribe("edge/faults");

    mqttClient.on("message", (topic, msg) => {
      if (topic.startsWith("edge/inverters/")) {
        const id = topic.split("/")[2];
        setInverters((prev) => ({
          ...prev,
          [id]: msg.toString(),
        }));
      }

      if (topic === "edge/faults") {
        setFaults((prev) => [...prev, msg.toString()]);
      }
    });
  }, []);

  return (
    <div>
      <h1>Execution Plane</h1>
      <pre>{JSON.stringify(inverters, null, 2)}</pre>

      <h2>Faults</h2>
      <ul>
        {faults.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
