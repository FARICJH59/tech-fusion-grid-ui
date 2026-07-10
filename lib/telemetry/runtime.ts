import type { TelemetrySnapshot } from "@/components/GridPipelineCanvas";

type TelemetryStatus = "disconnected" | "connecting" | "connected";
type TelemetryEvent = { data: unknown };
type TelemetrySocket = {
  onopen: (() => void) | null;
  onmessage: ((event: TelemetryEvent) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: () => void;
};
type TimerHandle = ReturnType<typeof setTimeout>;
type TelemetryRuntimeOptions = {
  url: string;
  reconnectDelayMs: number;
  socketFactory: (url: string) => TelemetrySocket;
  scheduleReconnect: (callback: () => void, delayMs: number) => TimerHandle;
  cancelReconnect: (handle: TimerHandle) => void;
  onStatus: (status: TelemetryStatus) => void;
  onError: (message: string | null) => void;
  onTelemetry: (next: TelemetrySnapshot) => void;
  telemetryEquals: (a: TelemetrySnapshot, b: TelemetrySnapshot) => boolean;
  parseTelemetry: (value: unknown) => TelemetrySnapshot | null;
  initialTelemetry: TelemetrySnapshot;
};

const DEFAULT_TELEMETRY: TelemetrySnapshot = {
  triton: { latency: 12, queueDepth: 3, tps: 100 },
  z3: { latency: 20, queueDepth: 1, isSolving: false },
  commit: { latency: 5, queueDepth: 0 },
};

const telemetryEquals = (a: TelemetrySnapshot, b: TelemetrySnapshot) =>
  a.triton.latency === b.triton.latency &&
  a.triton.queueDepth === b.triton.queueDepth &&
  a.triton.tps === b.triton.tps &&
  a.z3.latency === b.z3.latency &&
  a.z3.queueDepth === b.z3.queueDepth &&
  a.z3.isSolving === b.z3.isSolving &&
  a.commit.latency === b.commit.latency &&
  a.commit.queueDepth === b.commit.queueDepth;

const asTelemetrySnapshot = (value: unknown): TelemetrySnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const input = value as TelemetrySnapshot;

  if (
    typeof input.triton?.latency !== "number" ||
    typeof input.triton?.queueDepth !== "number" ||
    typeof input.triton?.tps !== "number" ||
    typeof input.z3?.latency !== "number" ||
    typeof input.z3?.queueDepth !== "number" ||
    typeof input.z3?.isSolving !== "boolean" ||
    typeof input.commit?.latency !== "number" ||
    typeof input.commit?.queueDepth !== "number"
  ) {
    return null;
  }

  return input;
};

const createTelemetryRuntime = (options: TelemetryRuntimeOptions) => {
  let socket: TelemetrySocket | null = null;
  let reconnectTimer: TimerHandle | null = null;
  let running = false;
  let latestTelemetry = options.initialTelemetry;

  const scheduleReconnect = () => {
    if (!running || reconnectTimer) {
      return;
    }
    reconnectTimer = options.scheduleReconnect(() => {
      reconnectTimer = null;
      connect();
    }, options.reconnectDelayMs);
  };

  const connect = () => {
    if (!running) {
      return;
    }

    try {
      options.onStatus("connecting");
      socket = options.socketFactory(options.url);
    } catch {
      options.onStatus("disconnected");
      options.onError("Failed to initialize telemetry socket.");
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      options.onStatus("connected");
      options.onError(null);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as unknown;
        const next = options.parseTelemetry(parsed);
        if (!next) {
          options.onError("Malformed telemetry payload ignored.");
          return;
        }
        if (!options.telemetryEquals(latestTelemetry, next)) {
          latestTelemetry = next;
          options.onTelemetry(next);
        }
        options.onError(null);
      } catch {
        options.onError("Telemetry message parsing failed.");
      }
    };

    socket.onerror = () => {
      options.onError("Telemetry socket error.");
    };

    socket.onclose = () => {
      if (!running) {
        return;
      }
      options.onStatus("disconnected");
      scheduleReconnect();
    };
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      connect();
    },
    stop() {
      running = false;
      if (reconnectTimer) {
        options.cancelReconnect(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        socket = null;
      }
    },
  };
};

export {
  DEFAULT_TELEMETRY,
  asTelemetrySnapshot,
  createTelemetryRuntime,
  telemetryEquals,
  type TelemetryStatus,
  type TelemetrySocket,
};
