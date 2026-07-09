import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TELEMETRY,
  asTelemetrySnapshot,
  createTelemetryRuntime,
  telemetryEquals,
  type TelemetrySocket,
  type TelemetryStatus,
} from "../lib/telemetry/runtime";
import type { TelemetrySnapshot } from "../components/GridPipelineCanvas";

class FakeSocket implements TelemetrySocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closeCount = 0;

  close() {
    this.closeCount += 1;
  }
}

const sampleTelemetry: TelemetrySnapshot = {
  triton: { latency: 30, queueDepth: 2, tps: 250 },
  z3: { latency: 9, queueDepth: 1, isSolving: true },
  commit: { latency: 4, queueDepth: 0 },
};

test("reconnects after close and emits status changes", async () => {
  const sockets: FakeSocket[] = [];
  const statuses: TelemetryStatus[] = [];

  const runtime = createTelemetryRuntime({
    url: "ws://example.test",
    reconnectDelayMs: 0,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    scheduleReconnect: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelReconnect: (handle) => clearTimeout(handle),
    onStatus: (status) => statuses.push(status),
    onError: () => undefined,
    onTelemetry: () => undefined,
    telemetryEquals,
    parseTelemetry: asTelemetrySnapshot,
    initialTelemetry: DEFAULT_TELEMETRY,
  });

  runtime.start();
  assert.equal(sockets.length, 1);
  sockets[0].onopen?.();
  sockets[0].onclose?.();

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(sockets.length, 2);
  assert.ok(statuses.includes("connecting"));
  assert.ok(statuses.includes("connected"));
  assert.ok(statuses.includes("disconnected"));

  runtime.stop();
});

test("handles malformed telemetry and suppresses duplicate telemetry updates", () => {
  const errors: Array<string | null> = [];
  const telemetryUpdates: TelemetrySnapshot[] = [];
  const socketRef: { current: FakeSocket | undefined } = { current: undefined };

  const runtime = createTelemetryRuntime({
    url: "ws://example.test",
    reconnectDelayMs: 0,
    socketFactory: () => {
      const socket = new FakeSocket();
      socketRef.current = socket;
      return socket;
    },
    scheduleReconnect: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelReconnect: (handle) => clearTimeout(handle),
    onStatus: () => undefined,
    onError: (message) => errors.push(message),
    onTelemetry: (next) => telemetryUpdates.push(next),
    telemetryEquals,
    parseTelemetry: asTelemetrySnapshot,
    initialTelemetry: DEFAULT_TELEMETRY,
  });

  runtime.start();
  const socket = socketRef.current;
  if (!socket) {
    throw new Error("Expected telemetry socket to be initialized");
  }

  socket.onmessage?.({ data: "not-json" });
  socket.onmessage?.({ data: JSON.stringify({ invalid: true }) });
  socket.onmessage?.({ data: JSON.stringify(sampleTelemetry) });
  socket.onmessage?.({ data: JSON.stringify(sampleTelemetry) });

  assert.equal(telemetryUpdates.length, 1);
  assert.equal(errors[0], "Telemetry message parsing failed.");
  assert.equal(errors[1], "Malformed telemetry payload ignored.");
  assert.equal(errors[errors.length - 1], null);

  runtime.stop();
});

test("stops runtime without leaking socket handlers", () => {
  const socketRef: { current: FakeSocket | undefined } = { current: undefined };

  const runtime = createTelemetryRuntime({
    url: "ws://example.test",
    reconnectDelayMs: 0,
    socketFactory: () => {
      const socket = new FakeSocket();
      socketRef.current = socket;
      return socket;
    },
    scheduleReconnect: (callback, delayMs) => setTimeout(callback, delayMs),
    cancelReconnect: (handle) => clearTimeout(handle),
    onStatus: () => undefined,
    onError: () => undefined,
    onTelemetry: () => undefined,
    telemetryEquals,
    parseTelemetry: asTelemetrySnapshot,
    initialTelemetry: DEFAULT_TELEMETRY,
  });

  runtime.start();
  const socket = socketRef.current;
  if (!socket) {
    throw new Error("Expected telemetry socket to be initialized");
  }
  runtime.stop();

  assert.equal(socket.closeCount, 1);
  assert.equal(socket.onopen, null);
  assert.equal(socket.onclose, null);
  assert.equal(socket.onerror, null);
  assert.equal(socket.onmessage, null);
});
