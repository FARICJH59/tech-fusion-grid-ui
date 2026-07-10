export const AGENT_FRAMEWORK_FEATURES = [
  "Agent templates",
  "Multi-agent orchestration",
  "Long-running workflows",
  "Event-driven execution",
  "Memory",
  "Knowledge retrieval",
  "Tool execution",
  "Approval workflows",
  "Human-in-the-loop",
  "Agent versioning",
  "Agent lifecycle management",
] as const;

export type AgentStatus = "draft" | "active" | "paused" | "retired";

export type AgentTemplate = {
  id: string;
  name: string;
  description: string;
  tools: string[];
  knowledgeSources: string[];
};

export type AgentDefinition = {
  id: string;
  templateId: string;
  version: string;
  status: AgentStatus;
  approvalsRequired: boolean;
};

export type WorkflowRun = {
  id: string;
  agentId: string;
  status: "running" | "completed" | "failed";
  events: string[];
  memory: Record<string, string>;
};

export class EnterpriseAgentFramework {
  private readonly templates = new Map<string, AgentTemplate>();
  private readonly agents = new Map<string, AgentDefinition>();
  private readonly workflows = new Map<string, WorkflowRun>();

  registerTemplate(template: AgentTemplate): void {
    this.templates.set(template.id, template);
  }

  createAgent(definition: AgentDefinition): void {
    if (!this.templates.has(definition.templateId)) {
      throw new Error(`Unknown template '${definition.templateId}'`);
    }
    this.agents.set(definition.id, definition);
  }

  updateLifecycle(agentId: string, status: AgentStatus): void {
    const current = this.agents.get(agentId);
    if (!current) throw new Error(`Unknown agent '${agentId}'`);
    this.agents.set(agentId, { ...current, status });
  }

  startWorkflow(run: WorkflowRun): void {
    if (!this.agents.has(run.agentId)) {
      throw new Error(`Unknown agent '${run.agentId}'`);
    }
    this.workflows.set(run.id, run);
  }

  appendEvent(workflowId: string, event: string): void {
    const current = this.workflows.get(workflowId);
    if (!current) throw new Error(`Unknown workflow '${workflowId}'`);
    current.events.push(event);
    this.workflows.set(workflowId, current);
  }

  writeMemory(workflowId: string, key: string, value: string): void {
    const current = this.workflows.get(workflowId);
    if (!current) throw new Error(`Unknown workflow '${workflowId}'`);
    current.memory[key] = value;
    this.workflows.set(workflowId, current);
  }

  listAgents(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  listWorkflows(): WorkflowRun[] {
    return [...this.workflows.values()];
  }
}

export function createDefaultAgentFramework(): EnterpriseAgentFramework {
  const framework = new EnterpriseAgentFramework();
  framework.registerTemplate({
    id: "runtime-operator",
    name: "Runtime Operator",
    description: "Default template for runtime orchestration and approval-aware operations.",
    tools: ["scheduler", "dispatcher", "tool-registry"],
    knowledgeSources: ["tenant-policy", "runbook"],
  });
  return framework;
}
