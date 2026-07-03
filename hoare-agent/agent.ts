export type HoareTool = {
  name: string;
  description: string;
  parameters: Record<string, string>;
};

export type HoareSession = {
  id: string;
  createdAt: string;
  messages: HoareMessage[];
};

export type HoareMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
};

export type HoareExecuteRequest = {
  tool: string;
  parameters: Record<string, unknown>;
};

export type HoareExecuteResult = {
  success: boolean;
  output: unknown;
  error?: string;
};

const AVAILABLE_TOOLS: HoareTool[] = [
  {
    name: "telemetry_query",
    description: "Query real-time telemetry data from IoT devices",
    parameters: { deviceId: "string", metric: "string", window: "string" },
  },
  {
    name: "audit_log",
    description: "Record an action in the audit trail",
    parameters: { action: "string", details: "string" },
  },
  {
    name: "execute_command",
    description: "Execute a control command on an edge device",
    parameters: { deviceId: "string", command: "string", payload: "string" },
  },
  {
    name: "anomaly_detect",
    description: "Run anomaly detection on a data stream",
    parameters: { stream: "string", threshold: "string" },
  },
];

const sessions = new Map<string, HoareSession>();

export function createSession(): HoareSession {
  const id = `hoare-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const session: HoareSession = {
    id,
    createdAt: new Date().toISOString(),
    messages: [
      {
        role: "system",
        content:
          "You are HOARE, an autonomous AI agent for Tech Fusion Foundry. You have access to IoT telemetry, audit logging, edge command execution, and anomaly detection tools.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): HoareSession | undefined {
  return sessions.get(id);
}

export function listSessions(): HoareSession[] {
  return Array.from(sessions.values());
}

export function chat(sessionId: string, userMessage: string): HoareMessage {
  let session = sessions.get(sessionId);
  if (!session) {
    session = createSession();
    sessions.set(session.id, session);
  }

  const userMsg: HoareMessage = {
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMsg);

  const reply = generateReply(userMessage);
  const assistantMsg: HoareMessage = {
    role: "assistant",
    content: reply,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(assistantMsg);

  return assistantMsg;
}

function generateReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("telemetry")) {
    return "Querying telemetry streams… All monitored devices are reporting within normal parameters.";
  }
  if (lower.includes("anomal")) {
    return "Running anomaly detection… No significant deviations detected in the current observation window.";
  }
  if (lower.includes("audit")) {
    return "Audit log entry recorded. Compliance state is nominal.";
  }
  if (lower.includes("execute") || lower.includes("command")) {
    return "Command queued for execution on the target edge device. Awaiting acknowledgement.";
  }
  return `HOARE received: "${input}". How can I assist with your IoT control plane?`;
}

export function executeTool(req: HoareExecuteRequest): HoareExecuteResult {
  const tool = AVAILABLE_TOOLS.find((t) => t.name === req.tool);
  if (!tool) {
    return { success: false, output: null, error: `Unknown tool: ${req.tool}` };
  }

  const output = simulateToolExecution(req.tool, req.parameters);
  return { success: true, output };
}

function simulateToolExecution(
  tool: string,
  params: Record<string, unknown>
): unknown {
  switch (tool) {
    case "telemetry_query":
      return {
        deviceId: params.deviceId,
        metric: params.metric,
        value: (Math.random() * 100).toFixed(2),
        unit: "units",
        timestamp: new Date().toISOString(),
      };
    case "audit_log":
      return {
        logged: true,
        action: params.action,
        at: new Date().toISOString(),
      };
    case "execute_command":
      return {
        queued: true,
        deviceId: params.deviceId,
        command: params.command,
      };
    case "anomaly_detect":
      return {
        anomaliesFound: 0,
        stream: params.stream,
        scannedAt: new Date().toISOString(),
      };
    default:
      return { result: "ok" };
  }
}

export function getAvailableTools(): HoareTool[] {
  return AVAILABLE_TOOLS;
}
