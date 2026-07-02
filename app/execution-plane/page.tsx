"use client";

import { useEffect, useState } from "react";
import { mqttClient } from "@/lib/mqtt";

type InvertersState = Record<string, string>;
type MessagePayload = { toString(): string } | string;
type MessageHandler = (topic: string, message: MessagePayload) => void;

type MqttClientWithMessageApi = typeof mqttClient & {
  subscribe: ((topic: string) => void) & ((topic: string, handler: MessageHandler) => void);
  onMessage?: (handler: MessageHandler) => void | (() => void);
};

export default function ExecutionPlanePage() {
  const [inverters, setInverters] = useState<InvertersState>({});
  const [faults, setFaults] = useState<string[]>([]);

  useEffect(() => {
    const client = mqttClient as MqttClientWithMessageApi;
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

    if (typeof client.onMessage === "function") {
      client.subscribe("edge/inverters/#");
      client.subscribe("edge/faults");

      const unsubscribe = client.onMessage(handleMessage);
      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }

    client.subscribe("edge/inverters/#", handleMessage);
    client.subscribe("edge/faults", handleMessage);
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
