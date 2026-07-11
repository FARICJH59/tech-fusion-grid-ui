export const SDK_CHANNELS = ["REST", "Webhooks", "WebSocket", "MQTT"] as const;

export type SDKChannel = (typeof SDK_CHANNELS)[number];

export type SDKDefinition = {
  name: "TypeScript SDK" | "Python SDK";
  version: string;
  channels: SDKChannel[];
  baseUrl: string;
};

export class EnterpriseSDKRegistry {
  private readonly sdks = new Map<SDKDefinition["name"], SDKDefinition>();

  register(definition: SDKDefinition): void {
    this.sdks.set(definition.name, definition);
  }

  list(): SDKDefinition[] {
    return [...this.sdks.values()];
  }
}

export function createDefaultSDKRegistry(): EnterpriseSDKRegistry {
  const registry = new EnterpriseSDKRegistry();

  registry.register({
    name: "TypeScript SDK",
    version: "1.0.0",
    channels: [...SDK_CHANNELS],
    baseUrl: "/api/sdk/typescript",
  });

  registry.register({
    name: "Python SDK",
    version: "1.0.0",
    channels: [...SDK_CHANNELS],
    baseUrl: "/api/sdk/python",
  });

  return registry;
}
