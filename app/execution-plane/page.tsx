"use client";

import { useEffect, useState } from "react";
import { mqttClient } from "@/lib/mqtt";

type InvertersState = Record<string, string>;
type MessagePayload = { toString(): string } | string;
type MessageHandler = (topic: string, message: MessagePayload) => void;

type MqttClientWithOnMessageApi = {
  subscribe: (topic: string) => void;
  onMessage: (handler: MessageHandler) => void | (() => void);
};

const hasOnMessageApi = (client: unknown): client is MqttClientWithOnMessageApi => {
  if (typeof client !== "object" || client === null) return false;
  const candidate = client as { subscribe?: unknown; onMessage?: unknown };
  return typeof candidate.subscribe === "function" && typeof candidate.onMessage === "function";
};

export default function ExecutionPlanePage() {
  const [inverters, setInverters] = useState<InvertersState>({});
  const [faults, setFaults] = useState<string[]>([]);

  useEffect(() => {
    const client: unknown = mqttClient;

    const handleMessage: MessageHandler = (topic, msg) => {
      const message = msg.toString();

      if (topic.startsWith("edge/inverters/")) {
        const id = topic.split("/")[2];
        setInverters((prev) => ({ ...prev, [id]: message }));
      }

      if (topic === "edge/faults") {
        setFaults((prev) => [...prev, message]);
      }
    };

    if (hasOnMessageApi(client)) {
      client.subscribe("edge/inverters/#");
      client.subscribe("edge/faults");

      const unsubscribe = client.onMessage(handleMessage);
      if (typeof unsubscribe !== "function") {
        console.warn("mqttClient.onMessage did not return an unsubscribe handler.");
        return;
      }
      return () => unsubscribe();
    }

    const subscribeWithHandler = mqttClient.subscribe as (...args: unknown[]) => void;
    try {
      subscribeWithHandler("edge/inverters/#", handleMessage);
      subscribeWithHandler("edge/faults", handleMessage);
    } catch {
      console.warn(
        "mqttClient.subscribe callback mode unavailable; subscribing without message handler."
      );
      mqttClient.subscribe("edge/inverters/#");
      mqttClient.subscribe("edge/faults");
    }
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
