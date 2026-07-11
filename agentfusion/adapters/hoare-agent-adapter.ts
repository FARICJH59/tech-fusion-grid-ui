import type { CloudActionType } from "../../lib/cloud/cloud-types";
import type { Role } from "../../lib/auth";
import {
  AGENT_FRAMEWORK_FEATURES,
  EnterpriseAgentFramework,
  createDefaultAgentFramework,
  type AgentDefinition,
  type WorkflowRun,
} from "../../lib/enterprise/agents";
import { EnterpriseSecurity } from "../../lib/enterprise/security";
import { AutonomousPolicyEngine } from "../../lib/policy/engine";
import { ApprovalFlow } from "../../lib/policy/approval-flow";
import {
  AgentPermissionEvaluator,
  type Agent,
  type AgentEvaluationProfile,
  type AgentExecutionContext,
  type AgentPermission,
  type CapabilityDefinition,
  type MemoryContract,
  type PermissionEvaluationResult,
  type ToolReference,
  type WorkflowDefinition,
} from "../../packages/agent-sdk/src";

const HOARE_TOOLS = ["scheduler", "dispatcher", "tool-registry"] as const;
const CLOUD_ACTIONS = new Set<CloudActionType>(["deploy", "revision-update", "traffic-migration", "rollback", "scale", "health-verify", "remediation"]);

const HOARE_CAPABILITIES: CapabilityDefinition[] = [
  {
    id: "hoare-reasoning",
    name: "HOARE Reasoning",
    description: "Preserves existing reasoning workflows through the Agent SDK contract.",
    type: "reasoning",
    version: "1.0.0",
    actions: ["plan", "reason", "orchestrate"],
    tools: [...HOARE_TOOLS],
    workflows: ["approval-aware-operations"],
  },
  {
    id: "hoare-automation",
    name: "HOARE Automation",
    description: "Exposes execution-oriented automation without changing runtime behavior.",
    type: "automation",
    version: "1.0.0",
    actions: ["execute", "monitor", "coordinate"],
    tools: [...HOARE_TOOLS],
    workflows: ["approval-aware-operations"],
  },
  {
    id: "hoare-retrieval",
    name: "HOARE Retrieval",
    description: "Maps HOARE knowledge and workflow memory access into the SDK layer.",
    type: "retrieval",
    version: "1.0.0",
    actions: ["retrieve", "recall"],
    tools: [...HOARE_TOOLS],
    workflows: ["approval-aware-operations"],
  },
];

const HOARE_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "approval-aware-operations",
    name: "Approval Aware Operations",
    version: "1.0.0",
    description: "Standardized adapter workflow that preserves the existing HOARE runtime approval path.",
    collaborationMode: "multi-agent",
    approvalMode: "policy-based",
    eventStrategy: "emit-per-step",
    steps: [
      {
        id: "plan-operation",
        name: "Plan Operation",
        type: "task",
        emits: ["workflow.started"],
      },
      {
        id: "invoke-runtime-tool",
        name: "Invoke Runtime Tool",
        type: "tool",
        dependsOn: ["plan-operation"],
        toolId: "dispatcher",
      },
      {
        id: "approval-checkpoint",
        name: "Approval Checkpoint",
        type: "approval",
        dependsOn: ["invoke-runtime-tool"],
        requiresApproval: true,
      },
      {
        id: "emit-runtime-event",
        name: "Emit Runtime Event",
        type: "event",
        dependsOn: ["approval-checkpoint"],
        emits: ["workflow.completed"],
      },
    ],
  },
];

const HOARE_MEMORY: MemoryContract = {
  requiredMemoryType: "hybrid",
  storageAdapter: "enterprise-agent-framework",
  retentionPolicy: {
    strategy: "session",
    ttlSeconds: 86_400,
    maxEntries: 1_000,
  },
  namespaces: ["workflow-context", "tenant-knowledge", "preferences", "historical-interactions"],
};

const HOARE_EVALUATION: AgentEvaluationProfile = {
  tests: [
    { id: "capability-contract", name: "Capability contract", type: "capability" },
    { id: "workflow-contract", name: "Workflow contract", type: "workflow" },
  ],
  metrics: ["successRate", "latencyMs", "costUsd", "safetyScore", "reliabilityScore"],
  qualityScoring: "weighted-balanced",
};

export type HoareAgentAdapterOptions = {
  framework?: EnterpriseAgentFramework;
  security?: EnterpriseSecurity;
  approvalFlow?: ApprovalFlow;
  policyEngine?: AutonomousPolicyEngine;
  tools?: readonly string[];
  capabilities?: CapabilityDefinition[];
  workflows?: WorkflowDefinition[];
  domain?: string;
  description?: string;
  defaultTemplateId?: string;
};

export class HoareAgentAdapter {
  readonly framework: EnterpriseAgentFramework;
  readonly security: EnterpriseSecurity;
  readonly approvalFlow: ApprovalFlow;
  readonly policyEngine: AutonomousPolicyEngine;
  private readonly tools: readonly string[];
  private readonly capabilities: CapabilityDefinition[];
  private readonly workflows: WorkflowDefinition[];
  private readonly permissionEvaluator: AgentPermissionEvaluator;
  private readonly domain: string;
  private readonly description: string;
  private readonly defaultTemplateId: string;

  constructor(options: HoareAgentAdapterOptions = {}) {
    this.framework = options.framework ?? createDefaultAgentFramework();
    this.security = options.security ?? new EnterpriseSecurity();
    this.approvalFlow = options.approvalFlow ?? new ApprovalFlow();
    this.policyEngine = options.policyEngine ?? new AutonomousPolicyEngine(undefined, this.approvalFlow);
    this.tools = options.tools ?? HOARE_TOOLS;
    this.capabilities = options.capabilities ?? HOARE_CAPABILITIES;
    this.workflows = options.workflows ?? HOARE_WORKFLOWS;
    this.domain = options.domain ?? "enterprise-operations";
    this.description =
      options.description ??
      "HOARE-Agent adapter exposing the existing reasoning engine, workflows, and APIs through the Agent SDK contract.";
    this.defaultTemplateId = options.defaultTemplateId ?? "runtime-operator";
    this.permissionEvaluator = new AgentPermissionEvaluator({
      authorize: ({ permission, context, resourceTenantId }) =>
        this.security.isAuthorized({
          role: context.actor.role as Role,
          requiredRole: permission.requiredRole as Role,
          tenantId: context.tenant.tenantId,
          resourceTenantId: resourceTenantId ?? context.tenant.tenantId,
          attributes: permission.attributes,
        }),
      evaluatePolicy: ({ permission, context }) => this.evaluatePolicy(permission, context),
    });
  }

  listAgents(): Agent[] {
    return this.framework.listAgents().map((definition) => this.toSdkAgent(definition));
  }

  registerAgent(agent: Agent): AgentDefinition {
    const definition: AgentDefinition = {
      id: agent.identity.id,
      templateId: (agent.metadata?.templateId as string | undefined) ?? this.defaultTemplateId,
      version: agent.identity.version,
      status: "draft",
      approvalsRequired: agent.permissions.some((permission) => permission.approvalRequired),
    };

    this.framework.createAgent(definition);
    return definition;
  }

  startWorkflow(agentId: string, workflowId: string): WorkflowRun {
    const workflow = this.workflows.find((candidate) => candidate.id === workflowId);
    if (!workflow) {
      throw new Error(`Unknown HOARE workflow '${workflowId}'.`);
    }

    const run: WorkflowRun = {
      id: `${workflowId}:${agentId}`,
      agentId,
      status: "running",
      events: workflow.steps.map((step) => `${workflow.id}:${step.id}`),
      memory: {},
    };

    this.framework.startWorkflow(run);
    return run;
  }

  appendWorkflowEvent(workflowRunId: string, event: string): void {
    this.framework.appendEvent(workflowRunId, event);
  }

  writeWorkflowMemory(workflowRunId: string, key: string, value: string): void {
    this.framework.writeMemory(workflowRunId, key, value);
  }

  async evaluatePermission(
    permission: AgentPermission,
    context: AgentExecutionContext,
    agentId?: string,
  ): Promise<PermissionEvaluationResult> {
    return this.permissionEvaluator.evaluate({
      permission,
      context,
      agentId,
      resourceTenantId: context.tenant.tenantId,
    });
  }

  integrationStatus() {
    return {
      reasoningEngine: "preserved",
      workflows: "delegated-to-enterprise-agent-framework",
      apis: "unchanged",
      security: [
        "EnterpriseSecurity RBAC/ABAC",
        "AutonomousPolicyEngine",
        "ApprovalFlow",
      ],
      eventCompatibility: "Autonomous event emission compatible via workflow events and approval flow side effects",
      capabilities: AGENT_FRAMEWORK_FEATURES,
    };
  }

  private toSdkAgent(definition: AgentDefinition): Agent {
    const tools: ToolReference[] = this.tools.map((toolId) => ({
      id: toolId,
      name: toDisplayName(toolId),
      description: `Existing HOARE runtime tool '${toolId}' exposed through the Agent SDK adapter.`,
      category: toolId === "dispatcher" ? "enterprise" : "cloud",
      permissions: this.defaultPermissions().map((permission) => permission.id),
    }));

    return {
      identity: {
        id: definition.id,
        name: toDisplayName(definition.id),
        version: definition.version,
        description: this.description,
      },
      purpose: {
        mission: "Expose HOARE-Agent core capabilities through the standardized Agent SDK contract.",
        domain: this.domain,
        objectives: [
          "Preserve existing reasoning engine behavior",
          "Preserve existing workflow orchestration",
          "Expose tools, permissions, and memory through stable interfaces",
        ],
      },
      capabilities: {
        supportedActions: [...new Set(this.capabilities.flatMap((capability) => capability.actions))],
        supportedTools: [...this.tools],
        registered: this.capabilities,
        supportedWorkflows: this.workflows.map((workflow) => workflow.id),
      },
      tools,
      memory: HOARE_MEMORY,
      permissions: this.defaultPermissions(),
      workflows: this.workflows,
      evaluation: HOARE_EVALUATION,
      metadata: {
        templateId: definition.templateId,
        status: definition.status,
        approvalsRequired: definition.approvalsRequired,
        integration: this.integrationStatus(),
      },
    };
  }

  private async evaluatePolicy(
    permission: AgentPermission,
    context: AgentExecutionContext,
  ): Promise<{ allowed: boolean; approvalRequired?: boolean; reason?: string }> {
    if (CLOUD_ACTIONS.has(permission.action as CloudActionType)) {
      const decision = this.policyEngine.evaluate({
        id: `${permission.id}:${context.requestId}`,
        tenantId: context.tenant.tenantId,
        actionType: permission.action as CloudActionType,
        resource: permission.resource,
        requestedBy: context.actor.id,
        reason: permission.description,
        riskLevel: permission.riskLevel ?? "low",
        previousState: {},
        newState: {
          projectedCostUsd: context.budget?.maxCostUsd ?? 0,
          budgetLimitUsd: context.budget?.maxCostUsd ?? 100,
        },
        approvalStatus: "not-required",
        executionStatus: "requested",
        timestamp: new Date().toISOString(),
      });

      return {
        allowed: decision.decision !== "reject",
        approvalRequired: decision.decision === "escalate",
        reason: decision.reason,
      };
    }

    if (permission.approvalRequired) {
      this.approvalFlow.create(context.tenant.tenantId, permission.id, "pending");
      return {
        allowed: true,
        approvalRequired: true,
        reason: "Approval workflow gate activated by agent permission contract.",
      };
    }

    return {
      allowed: true,
      approvalRequired: false,
      reason: "Existing HOARE security contracts approved the action.",
    };
  }

  private defaultPermissions(): AgentPermission[] {
    return [
      {
        id: "hoare-runtime-read",
        resource: "runtime-status",
        action: "read-status",
        description: "Read tenant-scoped runtime status and operational summaries.",
        requiredRole: "viewer",
        tenantScope: "current-tenant",
        securityPolicies: ["tenant-isolation", "rbac", "audit"],
        auditRequired: true,
        attributes: { scope: "read" },
      },
      {
        id: "hoare-runtime-operate",
        resource: "runtime-workflow",
        action: "deploy",
        description: "Execute policy-gated runtime deployment workflows.",
        requiredRole: "operator",
        tenantScope: "current-tenant",
        securityPolicies: ["tenant-isolation", "rbac", "phase8-policy-engine", "approval-workflow", "audit"],
        auditRequired: true,
        attributes: { scope: "write" },
        riskLevel: "medium",
      },
      {
        id: "hoare-memory-write",
        resource: "workflow-memory",
        action: "write-memory",
        description: "Write workflow context to existing HOARE memory abstractions.",
        requiredRole: "operator",
        tenantScope: "current-tenant",
        securityPolicies: ["tenant-isolation", "abac", "agent-memory", "audit"],
        auditRequired: true,
        approvalRequired: false,
        attributes: { scope: "write" },
      },
    ];
  }
}

export function createHoareAgentAdapter(options: HoareAgentAdapterOptions = {}): HoareAgentAdapter {
  return new HoareAgentAdapter(options);
}

function toDisplayName(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
