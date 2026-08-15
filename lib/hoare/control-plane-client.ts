export type HoareHealth = {
  service?: string;
  status?: string;
  timestamp?: string;
};

export type HoareAgent = Record<string, unknown> & { name?: string; id?: string };
export type HoareTool = Record<string, unknown> & { name?: string; id?: string };

export type ControlPlaneOverview = {
  connected: boolean;
  mode: "LOCAL_CONTROL_PLANE" | "MCP_CONNECTED" | "MCP_CONFIGURED";
  health: HoareHealth | null;
  agents: HoareAgent[];
  tools: HoareTool[];
  capabilities: {
    agents: boolean;
    tools: boolean;
    workflows: boolean;
    tenants: boolean;
    identity: boolean;
    policies: boolean;
    runtime: boolean;
    deployments: boolean;
    billing: boolean;
  };
  timestamp: string;
};

function baseUrl() {
  const value = process.env.HOARE_MCP_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`HOARE MCP request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getControlPlaneOverview(): Promise<ControlPlaneOverview> {
  const timestamp = new Date().toISOString();
  const mcp = baseUrl();

  if (!mcp) {
    return {
      connected: false,
      mode: "LOCAL_CONTROL_PLANE",
      health: null,
      agents: [],
      tools: [],
      capabilities: {
        agents: true,
        tools: true,
        workflows: true,
        tenants: true,
        identity: true,
        policies: true,
        runtime: true,
        deployments: true,
        billing: true,
      },
      timestamp,
    };
  }

  try {
    const [health, agentsPayload, toolsPayload] = await Promise.all([
      getJson<HoareHealth>(`${mcp}/health`),
      getJson<{ agents?: HoareAgent[] }>(`${mcp}/agents`),
      getJson<{ tools?: HoareTool[] }>(`${mcp}/tools`),
    ]);

    return {
      connected: true,
      mode: "MCP_CONNECTED",
      health,
      agents: agentsPayload.agents || [],
      tools: toolsPayload.tools || [],
      capabilities: {
        agents: true,
        tools: true,
        workflows: true,
        tenants: true,
        identity: true,
        policies: true,
        runtime: true,
        deployments: true,
        billing: true,
      },
      timestamp,
    };
  } catch {
    return {
      connected: false,
      mode: "MCP_CONFIGURED",
      health: null,
      agents: [],
      tools: [],
      capabilities: {
        agents: true,
        tools: true,
        workflows: true,
        tenants: true,
        identity: true,
        policies: true,
        runtime: true,
        deployments: true,
        billing: true,
      },
      timestamp,
    };
  }
}
