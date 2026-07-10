import mqtt, { type IClientOptions, type MqttClient as MqttJsClient } from "mqtt";
type MessageHandler = (topic: string, message: string) => void;
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";
type ConnectionStateHandler = (state: ConnectionState) => void;
type ReconnectHandler = () => void;
type MockMQTTDebugSnapshot = {
  handlers: number;
  subscriptions: number;
  connectionStateHandlers: number;
  reconnectHandlers: number;
  state: ConnectionState;
};

/** QoS levels supported by MQTT. */
type QoS = 0 | 1 | 2;

/** Options for subscribing to a topic. */
type SubscribeOptions = {
  qos?: QoS;
};

/** Options for publishing to a topic. */
type PublishOptions = {
  qos?: QoS;
  retain?: boolean;
};

/** Shared interface implemented by both the real client and the test double. */
interface MqttClientInterface {
  connect(): void;
  disconnect(): void;
  subscribe(topic: string, options?: SubscribeOptions): () => void;
  unsubscribe(topic: string): void;
  publish(topic: unknown, message: unknown, options?: PublishOptions): void;
  on(handler: MessageHandler): () => void;
  off(handler: MessageHandler): void;
  onConnectionStateChange(handler: ConnectionStateHandler): () => void;
  onReconnect(handler: ReconnectHandler): () => void;
  getConnectionState(): ConnectionState;
}

// ---------------------------------------------------------------------------
// Exponential back-off helpers
// ---------------------------------------------------------------------------

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const TOPIC_PREVIEW_LENGTH = 40;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const generateRandomHex = (byteCount: number) => {
  const bytes = new Uint8Array(byteCount);

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const computeBackoff = (attempt: number): number => {
  const jitter = Math.random() * 0.3 + 0.85; // 0.85–1.15
  return clamp(BACKOFF_BASE_MS * 2 ** attempt * jitter, BACKOFF_BASE_MS, BACKOFF_MAX_MS);
};

// ---------------------------------------------------------------------------
// Configuration options for the real MQTT client
// ---------------------------------------------------------------------------

type MqttClientOptions = {
  /** MQTT broker URL, e.g. "mqtt://localhost:1883" or "mqtts://broker:8883" */
  brokerUrl?: string;
  /** MQTT username for authentication */
  username?: string;
  /** MQTT password for authentication */
  password?: string;
  /** Client identifier — defaults to a random ID */
  clientId?: string;
  /** TLS CA certificate (PEM) for mqtts:// connections */
  ca?: string;
  /** TLS client certificate (PEM) */
  cert?: string;
  /** TLS client private key (PEM) */
  key?: string;
  /** Reject unauthorised TLS certificates. Defaults to true. */
  rejectUnauthorized?: boolean;
  /** Last Will and Testament message */
  will?: {
    topic: string;
    payload: string;
    qos?: QoS;
    retain?: boolean;
  };
};

// ---------------------------------------------------------------------------
// Real MQTT client backed by mqtt.js
// ---------------------------------------------------------------------------

class MqttClient implements MqttClientInterface {
  private readonly options: MqttClientOptions;
  private client: MqttJsClient | null = null;
  private handlers = new Set<MessageHandler>();
  private subscriptions = new Map<string, QoS>();
  private connectionStateHandlers = new Set<ConnectionStateHandler>();
  private reconnectHandlers = new Set<ReconnectHandler>();
  private state: ConnectionState = "disconnected";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: MqttClientOptions = {}) {
    this.options = options;
  }

  private setState(nextState: ConnectionState) {
    if (this.state === nextState) return;
    this.state = nextState;
    this.connectionStateHandlers.forEach((h) => {
      try {
        h(nextState);
      } catch (err) {
        console.error("[MQTT] connectionStateHandler threw", err);
      }
    });
  }

  private buildClientOptions(): IClientOptions {
    const {
      username,
      password,
      clientId = `techfusion-${generateRandomHex(4)}`,
      ca,
      cert,
      key,
      rejectUnauthorized = true,
      will,
    } = this.options;

    const opts: IClientOptions = {
      clientId,
      clean: true,
      // Disable mqtt.js auto-reconnect; we manage it ourselves for exponential back-off
      reconnectPeriod: 0,
    };

    if (username) opts.username = username;
    if (password) opts.password = password;

    if (ca || cert || key) {
      opts.ca = ca ? [Buffer.from(ca)] : undefined;
      opts.cert = cert ? Buffer.from(cert) : undefined;
      opts.key = key ? Buffer.from(key) : undefined;
      opts.rejectUnauthorized = rejectUnauthorized;
    }

    if (will) {
      opts.will = {
        topic: will.topic,
        payload: will.payload,
        qos: will.qos ?? 1,
        retain: will.retain ?? false,
      };
    }

    return opts;
  }

  private resubscribeAll() {
    if (!this.client || this.state !== "connected") return;
    for (const [topic, qos] of this.subscriptions) {
      this.client.subscribe(topic, { qos }, (err) => {
        if (err) console.error(`[MQTT] Resubscribe failed for ${topic}`, err);
      });
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (!this.client || this.state !== "connected") return;
      // PINGREQ is sent automatically by mqtt.js keepAlive, but we can also
      // verify the connection is alive by publishing to a system topic.
      this.heartbeatTimeout = setTimeout(() => {
        console.warn("[MQTT] Heartbeat timeout — forcing reconnect");
        this.client?.end(true);
      }, HEARTBEAT_TIMEOUT_MS);
      // mqtt.js pings internally; clear the timeout on next successful message
      // by wrapping a one-time check on the "packetreceive" event.
      const clearHb = () => {
        if (this.heartbeatTimeout) {
          clearTimeout(this.heartbeatTimeout);
          this.heartbeatTimeout = null;
        }
        this.client?.removeListener("packetreceive", clearHb);
      };
      this.client?.once("packetreceive", clearHb);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = computeBackoff(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    console.info(`[MQTT] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);
    this.setState("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private doConnect() {
    const brokerUrl = this.options.brokerUrl ?? process.env.MQTT_URL;
    if (!brokerUrl) {
      console.warn("[MQTT] No broker URL configured — skipping connect");
      this.setState("disconnected");
      return;
    }

    this.setState("connecting");
    const opts = this.buildClientOptions();

    let client: MqttJsClient;
    try {
      client = mqtt.connect(brokerUrl, opts);
    } catch (err) {
      console.error("[MQTT] mqtt.connect threw", err);
      this.setState("disconnected");
      this.scheduleReconnect();
      return;
    }

    this.client = client;

    client.on("connect", () => {
      this.reconnectAttempt = 0;
      this.setState("connected");
      this.resubscribeAll();
      this.startHeartbeat();
    });

    client.on("reconnect", () => {
      // Fires when mqtt.js itself retries (we disable its auto-reconnect, so
      // this should not fire, but guard it anyway).
      this.setState("reconnecting");
    });

    client.on("message", (topic, payload) => {
      const message = payload.toString("utf8");
      this.handlers.forEach((h) => {
        try {
          h(topic, message);
        } catch (err) {
          console.error("[MQTT] message handler threw", err);
        }
      });
    });

    client.on("error", (err) => {
      console.error("[MQTT] Client error", err);
    });

    client.on("close", () => {
      this.stopHeartbeat();
      if (this.state === "disconnected") {
        // Intentional disconnect — do not reconnect.
        return;
      }
      this.setState("reconnecting");
      this.reconnectHandlers.forEach((h) => {
        try {
          h();
        } catch (err) {
          console.error("[MQTT] reconnect handler threw", err);
        }
      });
      this.scheduleReconnect();
    });

    client.on("offline", () => {
      this.stopHeartbeat();
      if (this.state !== "disconnected") {
        this.setState("reconnecting");
      }
    });
  }

  connect() {
    if (this.state === "connected" || this.state === "connecting") return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.setState("disconnected");
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  subscribe(topic: string, options: SubscribeOptions = {}): () => void {
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      console.warn("[MQTT] subscribe called with invalid topic", topic);
      return () => undefined;
    }
    const qos: QoS = options.qos ?? 0;
    this.subscriptions.set(topic, qos);
    if (this.client && this.state === "connected") {
      this.client.subscribe(topic, { qos }, (err) => {
        if (err) console.error(`[MQTT] Subscribe failed for ${topic}`, err);
      });
    }
    return () => this.unsubscribe(topic);
  }

  unsubscribe(topic: string) {
    this.subscriptions.delete(topic);
    if (this.client && this.state === "connected") {
      this.client.unsubscribe(topic, (err) => {
        if (err) console.error(`[MQTT] Unsubscribe failed for ${topic}`, err);
      });
    }
  }

  publish(topic: unknown, message: unknown, options: PublishOptions = {}) {
    if (typeof topic !== "string" || topic.trim().length === 0) {
      const topicPreview =
        typeof topic === "string" ? topic.slice(0, TOPIC_PREVIEW_LENGTH) : `[type: ${typeof topic}]`;
      console.warn("[MQTT] Dropped publish due to invalid topic", topicPreview);
      return;
    }
    if (typeof message !== "string") {
      console.warn("[MQTT] Dropped publish due to invalid payload type", typeof message);
      return;
    }
    if (this.state !== "connected" || !this.client) {
      return;
    }
    const qos: QoS = options.qos ?? 0;
    this.client.publish(topic, message, { qos, retain: options.retain ?? false }, (err) => {
      if (err) console.error(`[MQTT] Publish failed for ${topic}`, err);
    });
  }

  on(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.off(handler);
  }

  off(handler: MessageHandler) {
    this.handlers.delete(handler);
  }

  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler);
    try {
      handler(this.state);
    } catch (err) {
      console.error("[MQTT] onConnectionStateChange initial call threw", err);
    }
    return () => this.connectionStateHandlers.delete(handler);
  }

  onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }
}

// ---------------------------------------------------------------------------
// MockMQTT — test double, kept for unit tests that need deterministic behaviour
// without a running broker.
// ---------------------------------------------------------------------------

const matchTopic = (subscription: string, topic: string) => {
  if (subscription === topic) return true;
  if (subscription.endsWith("/#")) {
    const prefix = subscription.slice(0, -2);
    return topic === prefix || topic.startsWith(`${prefix}/`);
  }
  return false;
};

const MOCK_TOPIC_PREVIEW_LENGTH = 40;

const isValidTopicString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidMessageString = (value: unknown): value is string => typeof value === "string";

class MockMQTT implements MqttClientInterface {
  private handlers = new Set<MessageHandler>();
  private subscriptions = new Set<string>();
  private connectionStateHandlers = new Set<ConnectionStateHandler>();
  private reconnectHandlers = new Set<ReconnectHandler>();
  private state: ConnectionState = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private setState(nextState: ConnectionState) {
    if (this.state === nextState) return;
    this.state = nextState;
    this.connectionStateHandlers.forEach((handler) => handler(nextState));
  }

  private hasMatchingSubscription(topic: string) {
    for (const subscription of this.subscriptions) {
      if (matchTopic(subscription, topic)) return true;
    }
    return false;
  }

  connect() {
    if (this.state === "connected" || this.state === "connecting") return;
    this.setState("connecting");
    this.setState("connected");
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setState("disconnected");
  }

  simulateReconnect(delayMs = 300) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.setState("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.setState("connected");
      this.reconnectHandlers.forEach((handler) => handler());
    }, delayMs);
  }

  getConnectionState() {
    return this.state;
  }

  publish(topic: unknown, message: unknown) {
    if (!isValidTopicString(topic)) {
      const topicPreview =
        typeof topic === "string"
          ? topic.slice(0, MOCK_TOPIC_PREVIEW_LENGTH)
          : `[type: ${typeof topic}]`;
      console.warn("[MOCK MQTT] Dropped publish due to invalid topic", topicPreview);
      return;
    }
    if (!isValidMessageString(message)) {
      console.warn(
        "[MOCK MQTT] Dropped publish due to invalid payload type",
        typeof message,
        `(state: ${this.state}, subscriptions: ${this.subscriptions.size})`,
      );
      return;
    }
    if (this.state !== "connected") return;
    if (this.subscriptions.size === 0 || !this.hasMatchingSubscription(topic)) return;
    this.handlers.forEach((handler) => handler(topic, message));
  }

  subscribe(topic: string) {
    if (!isValidTopicString(topic)) return () => undefined;
    this.subscriptions.add(topic);
    return () => this.unsubscribe(topic);
  }

  unsubscribe(topic: string) {
    this.subscriptions.delete(topic);
  }

  on(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.off(handler);
  }

  off(handler: MessageHandler) {
    this.handlers.delete(handler);
  }

  onConnectionStateChange(handler: ConnectionStateHandler) {
    this.connectionStateHandlers.add(handler);
    // Immediately notify the new subscriber of the current state so callers do not need to
    // poll getConnectionState(). This pattern is intentional for state subscriptions only;
    // onReconnect is an event (not state) and has no meaningful "current value" to replay.
    // Wrapped in try/catch to prevent a throwing handler from disrupting registration or
    // the caller's execution context.
    try {
      handler(this.state);
    } catch (error) {
      console.error("[MOCK MQTT] onConnectionStateChange initial call threw", error);
    }
    return () => this.connectionStateHandlers.delete(handler);
  }

  onReconnect(handler: ReconnectHandler) {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  getDebugSnapshot(): MockMQTTDebugSnapshot {
    return {
      handlers: this.handlers.size,
      subscriptions: this.subscriptions.size,
      connectionStateHandlers: this.connectionStateHandlers.size,
      reconnectHandlers: this.reconnectHandlers.size,
      state: this.state,
    };
  }
}

const createMockMqttClient = () => new MockMQTT();

// ---------------------------------------------------------------------------
// Singleton — uses the real MQTT client when MQTT_URL is configured; falls
// back to MockMQTT in environments where no broker is present (e.g. CI with
// no MQTT service).
// ---------------------------------------------------------------------------

const mqttClient: MqttClientInterface =
  process.env.MQTT_URL
    ? new MqttClient({
        brokerUrl: process.env.MQTT_URL,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clientId: process.env.MQTT_CLIENT_ID,
        ca: process.env.MQTT_CA_CERT,
        cert: process.env.MQTT_CLIENT_CERT,
        key: process.env.MQTT_CLIENT_KEY,
        rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED !== "false",
        will: process.env.MQTT_LWT_TOPIC
          ? {
              topic: process.env.MQTT_LWT_TOPIC,
              payload: process.env.MQTT_LWT_PAYLOAD ?? "offline",
              qos: (Number(process.env.MQTT_LWT_QOS ?? 1) as QoS) || 1,
              retain: process.env.MQTT_LWT_RETAIN === "true",
            }
          : undefined,
      })
    : new MockMQTT();

export type { ConnectionState, MessageHandler, MockMQTTDebugSnapshot, MqttClientInterface, QoS };
export { MockMQTT, MqttClient, createMockMqttClient, mqttClient };
export default mqttClient;
