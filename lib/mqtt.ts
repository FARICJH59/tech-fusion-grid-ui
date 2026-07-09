type MessageHandler = (topic: string, message: string) => void;
type EventType = "message";

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

class MockMQTT {
  private handlers = new Set<MessageHandler>();
  private subscriptions = new Set<string>();

  publish(topic: string, message: string) {
    console.log(`[MOCK MQTT] ${topic}: ${message}`);

    if (this.subscriptions.size === 0) {
      return;
    }

    if (![...this.subscriptions].some((sub) => matchTopic(sub, topic))) {
      return;
    }

    this.handlers.forEach((handler) => handler(topic, message));
  }

  subscribe(topic: string) {
    this.subscriptions.add(topic);
    console.log(`[MOCK MQTT] Subscribed to ${topic}`);
  }

  unsubscribe(topic: string) {
    this.subscriptions.delete(topic);
    console.log(`[MOCK MQTT] Unsubscribed from ${topic}`);
  }

  on(_event: EventType, handler: MessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.off("message", handler);
    };
  }

  off(_event: EventType, handler: MessageHandler) {
    this.handlers.delete(handler);
  }
}

export const mqttClient = new MockMQTT();
export default mqttClient;
