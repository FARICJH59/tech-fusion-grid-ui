"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import { mqttClient, type ConnectionState } from "@/lib/mqtt";

type InverterState = Record<string, string>;
type ExecutionErrorState = {
  hasError: boolean;
  message: string;
};

const MAX_FAULTS = 100;
const INVERTER_TOPIC = "edge/inverters/#";
const FAULT_TOPIC = "edge/faults";
const MESSAGE_PREVIEW_LENGTH = 200;

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
      trimmed.slice(0, MESSAGE_PREVIEW_LENGTH),
      error,
    );
    return trimmed;
  }
};

class ExecutionErrorBoundary extends Component<{ children: ReactNode }, ExecutionErrorState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ExecutionErrorState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown runtime error",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ExecutionPlane] Render failure", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <h1>Execution Plane</h1>
          <p>Execution Plane failed to render.</p>
          <pre>{this.state.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function ExecutionPlaneContent() {
  const [inverters, setInverters] = useState<InverterState>({});
  const [faults, setFaults] = useState<string[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    mqttClient.getConnectionState(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const subscribeTopics = () => {
      mqttClient.subscribe(INVERTER_TOPIC);
      mqttClient.subscribe(FAULT_TOPIC);
    };

    mqttClient.connect();
    subscribeTopics();

    const unsubscribeConnectionState = mqttClient.onConnectionStateChange((state) => {
      if (!isMounted) {
        return;
      }
      setConnectionState(state);
      if (state === "connected") {
        setIsLoading(false);
      }
    });

    const unsubscribeReconnect = mqttClient.onReconnect(() => {
      if (!isMounted) {
        return;
      }
      subscribeTopics();
      setIsLoading(false);
    });

    const handleMessage = (topic: string, rawMessage: string) => {
      if (topic.startsWith("edge/inverters/")) {
        const id = topic.split("/")[2];
        if (!id) {
          return;
        }

        const message = normalizePayload(rawMessage);
        setInverters((prev) => {
          if (prev[id] === message) {
            return prev;
          }
          return { ...prev, [id]: message };
        });
        setStreamError(null);
        setIsLoading(false);
      }

      if (topic === FAULT_TOPIC) {
        const message = normalizePayload(rawMessage);
        if (!message) {
          return;
        }

        setFaults((prev) => {
          if (prev[prev.length - 1] === message) {
            return prev;
          }
          const next = [...prev, message];
          return next.length > MAX_FAULTS ? next.slice(-MAX_FAULTS) : next;
        });
        setStreamError(null);
        setIsLoading(false);
      }
    };

    const safeHandleMessage = (topic: string, rawMessage: string) => {
      try {
        handleMessage(topic, rawMessage);
      } catch (error) {
        // Strip control characters (U+0000–U+001F) and DEL (U+007F) from the ASCII range;
        // multi-byte Unicode codepoints outside ASCII are preserved as-is since this mock's
        // MQTT payloads are always plain ASCII strings.
        const message = rawMessage.slice(0, MESSAGE_PREVIEW_LENGTH).replace(/[^\x20-\x7E]/g, "?");
        setStreamError(
          `Failed to process MQTT message for topic "${topic}" with payload preview "${message}"`,
        );
        console.error("[ExecutionPlane] Message handling error", error);
      }
    };

    const unsubscribeHandler = mqttClient.on(safeHandleMessage);

    return () => {
      isMounted = false;
      unsubscribeHandler();
      unsubscribeReconnect();
      unsubscribeConnectionState();
      mqttClient.unsubscribe(INVERTER_TOPIC);
      mqttClient.unsubscribe(FAULT_TOPIC);
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
      <p>
        Connection: <strong>{connectionState}</strong>
      </p>
      {isLoading && <p>Loading execution stream…</p>}
      {streamError && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {streamError}
        </p>
      )}
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

export default function ExecutionPlanePage() {
  return (
    <ExecutionErrorBoundary>
      <ExecutionPlaneContent />
    </ExecutionErrorBoundary>
  );
}
