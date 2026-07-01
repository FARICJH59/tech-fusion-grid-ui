export const mqttClient = {
  publish: (topic: string, message: string) => console.log(`[MOCK MQTT] ${topic}: ${message}`),
  subscribe: (topic: string) => console.log(`[MOCK MQTT] Subscribed to ${topic}`),
};
export default mqttClient;
