type MessageHandler = (topic: string, message: string) => void;
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";
type ConnectionStateHandler = (state: ConnectionState) => void;
type ReconnectHandler = () => void;

const matchTopic = (subscription: string, topic: string) => {
  if (subscription === topic) {
    return true;
  }

  if (subscription.endsWith("/#")) {
    const prefix = subscription.slice(0, -2);
    return topic === prefix || topic.startsWith(`${prefix}/`);
  }

  return false;
};

const isValidTopic = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isValidMessage = (value: unknown): value is string => {
  return typeof value === "string";
};

class MockMQTT {
  private handlers = new Set<MessageHandler>();
  private subscriptions = new Set<string>();
  private connectionStateHandlers = new Set<ConnectionStateHandler>();
  private reconnectHandlers = new Set<ReconnectHandler>();
  private state: ConnectionState = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private setState(nextState: ConnectionState) {
    if (this.state === nextState) {
      return;
    }
    this.state = nextState;
    this.connectionStateHandlers.forEach((handler) => handler(nextState));
  }

  private hasMatchingSubscription(topic: string) {
    for (const subscription of this.subscriptions) {
      if (matchTopic(subscription, topic)) {
        return true;
      }
    }
    return false;
  }

  connect() {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
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
    if (!isValidTopic(topic)) {
      console.warn("[MOCK MQTT] Dropped publish due to invalid topic", topic);
      return;
    }

    if (!isValidMessage(message)) {
      console.warn("[MOCK MQTT] Dropped publish due to invalid payload type", typeof message);
      return;
    }

    if (this.state !== "connected") {
      return;
    }

    if (this.subscriptions.size === 0 || !this.hasMatchingSubscription(topic)) {
      return;
    }

    this.handlers.forEach((handler) => handler(topic, message));
  }

  subscribe(topic: string) {
    if (!isValidTopic(topic)) {
      return () => undefined;
    }
    this.subscriptions.add(topic);
    return () => {
      this.unsubscribe(topic);
    };
  }

  unsubscribe(topic: string) {
    this.subscriptions.delete(topic);
  }

  on(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.off(handler);
    };
  }

  off(handler: MessageHandler) {
    this.handlers.delete(handler);
  }

  onConnectionStateChange(handler: ConnectionStateHandler) {
    this.connectionStateHandlers.add(handler);
    handler(this.state);
    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  onReconnect(handler: ReconnectHandler) {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }
}

export type { ConnectionState, MessageHandler };
export const mqttClient = new MockMQTT();
export default mqttClient;
