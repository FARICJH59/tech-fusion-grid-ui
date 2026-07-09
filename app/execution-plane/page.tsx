"use client";

import { useEffect, useMemo, useState } from "react";
import { mqttClient } from "@/lib/mqtt";

type InverterState = Record<string, unknown>;

const MAX_FAULTS = 100;

const parsePayload = (payload: string) => {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
};

export default function ExecutionPlanePage() {
  const [inverters, setInverters] = useState<InverterState>({});
  const [faults, setFaults] = useState<string[]>([]);

  useEffect(() => {
    const inverterTopic = "edge/inverters/#";
    const faultTopic = "edge/faults";

    mqttClient.subscribe(inverterTopic);
    mqttClient.subscribe(faultTopic);

    const handleMessage = (topic: string, rawMessage: string) => {
      if (topic.startsWith("edge/inverters/")) {
        const id = topic.split("/")[2];
        if (!id) {
          return;
        }

        const parsed = parsePayload(rawMessage);
        setInverters((prev) => ({
          ...(prev[id] === parsed ? prev : { ...prev, [id]: parsed }),
        }));
      }

      if (topic === faultTopic) {
        const message = String(rawMessage);
        setFaults((prev) => {
          if (prev[prev.length - 1] === message) {
            return prev;
          }
          const next = [...prev, message];
          return next.length > MAX_FAULTS ? next.slice(-MAX_FAULTS) : next;
        });
      }
    };

    const unsubscribeHandler = mqttClient.on("message", handleMessage);

    return () => {
      unsubscribeHandler();
      mqttClient.unsubscribe(inverterTopic);
      mqttClient.unsubscribe(faultTopic);
    };
  }, []);

  const serializedInverters = useMemo(
    () => JSON.stringify(inverters, null, 2),
    [inverters],
  );

  return (
    <div>
      <h1>Execution Plane</h1>
      <pre>{serializedInverters}</pre>

      <h2>Faults</h2>
      <ul>
        {faults.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
