type MessageHandler = (topic: string, message: string) => void;

class MockMQTT {
  private handlers: MessageHandler[] = [];

  publish(topic: string, message: string) {
    console.log(`[MOCK MQTT] ${topic}: ${message}`);
    this.handlers.forEach((h) => h(topic, message));
  }

  subscribe(topic: string) {
    console.log(`[MOCK MQTT] Subscribed to ${topic}`);
  }

  on(_event: "message", handler: MessageHandler) {
    this.handlers.push(handler);
  }
}

export const mqttClient = new MockMQTT();
export default mqttClient;
