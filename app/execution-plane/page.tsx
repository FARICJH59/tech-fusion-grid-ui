"use client";

import { useEffect, useMemo, useState } from "react";
import { mqttClient } from "@/lib/mqtt";

type InverterState = Record<string, string>;

// Keep a rolling fault window to cap memory while preserving recent context for operators.
const MAX_FAULTS = 100;

const normalizePayload = (payload: string) => payload.trim();

const parsePayload = (payload: string): unknown => {
  const trimmed = normalizePayload(payload);
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    console.warn(
      "[ExecutionPlane] Failed to parse inverter payload",
      trimmed.slice(0, 100),
      error,
    );
    return trimmed;
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
        if (id === undefined) {
          return;
        }

        const message = normalizePayload(String(rawMessage));
        setInverters((prev) => {
          if (prev[id] === message) {
            return prev;
          }
          return { ...prev, [id]: message };
        });
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

    const unsubscribeHandler = mqttClient.on(handleMessage);

    return () => {
      unsubscribeHandler();
      mqttClient.unsubscribe(inverterTopic);
      mqttClient.unsubscribe(faultTopic);
    };
  }, []);

  const serializedInverters = useMemo(() => {
    const parsedInverters = Object.fromEntries(
      Object.entries(inverters).map(([id, payload]) => [id, parsePayload(payload)]),
    );
    return JSON.stringify(parsedInverters, null, 2);
  }, [inverters]);

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
