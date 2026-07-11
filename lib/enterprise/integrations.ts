export const ENTERPRISE_CONNECTORS = [
  "GitHub",
  "GitHub Copilot",
  "Google Workspace",
  "Microsoft 365",
  "Stripe",
  "Jira",
  "ServiceNow",
  "Salesforce",
  "Datadog",
  "Grafana",
] as const;

export type ConnectorName = (typeof ENTERPRISE_CONNECTORS)[number];

export type IntegrationContext = {
  tenantId: string;
  actorId: string;
  payload: Record<string, unknown>;
};

export type IntegrationResult = {
  connector: ConnectorName;
  status: "success" | "failed";
  detail: string;
};

export interface IntegrationPlugin {
  readonly name: ConnectorName;
  execute(context: IntegrationContext): Promise<IntegrationResult>;
}

class BaseConnectorPlugin implements IntegrationPlugin {
  constructor(public readonly name: ConnectorName) {}

  async execute(context: IntegrationContext): Promise<IntegrationResult> {
    return {
      connector: this.name,
      status: "success",
      detail: `Connector ${this.name} executed for tenant ${context.tenantId}`,
    };
  }
}

export class IntegrationLayer {
  private readonly plugins = new Map<ConnectorName, IntegrationPlugin>();

  register(plugin: IntegrationPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  list(): ConnectorName[] {
    return [...this.plugins.keys()];
  }

  async run(name: ConnectorName, context: IntegrationContext): Promise<IntegrationResult> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Connector '${name}' is not registered.`);
    }
    return plugin.execute(context);
  }
}

export function createDefaultIntegrationLayer(): IntegrationLayer {
  const layer = new IntegrationLayer();
  for (const name of ENTERPRISE_CONNECTORS) {
    layer.register(new BaseConnectorPlugin(name));
  }
  return layer;
}
