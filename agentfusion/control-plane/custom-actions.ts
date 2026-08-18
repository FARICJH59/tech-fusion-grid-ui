import { createHash, randomUUID } from "node:crypto";

export type ActionDecision = "ALLOW" | "DENY" | "ESCALATE";
export type Environment = "development" | "staging" | "production";
export type RunbookStep = { id: string; action: string; parameters?: Record<string, unknown>; requiresApproval?: boolean };

export type ActionRequest = {
  tenantId: string;
  actorId: string;
  action: string;
  resource: string;
  environment: Environment;
  requestId?: string;
  risk?: "low" | "medium" | "high" | "critical";
  estimatedCostUsd?: number;
  parameters?: Record<string, unknown>;
};

export type ActionPolicy = {
  allowedActions: string[];
  deniedActions?: string[];
  productionApproval?: boolean;
  maxCostUsd?: number;
  minRole?: "viewer" | "operator" | "admin" | "service";
};

export type ActionAuthorization = {
  decision: ActionDecision;
  reason: string;
  requestId: string;
};

export type Runbook = {
  id: string;
  version: number;
  tenantId: string;
  steps: RunbookStep[];
  checksum: string;
  active: boolean;
};

export type ShortLivedIdentity = {
  subject: string;
  audience: string;
  issuedAt: number;
  expiresAt: number;
  token: string;
};

export type ActionAuditEvent = {
  id: string;
  requestId: string;
  tenantId: string;
  actorId: string;
  action: string;
  resource: string;
  environment: Environment;
  decision: ActionDecision;
  timestamp: string;
};

const ROLE_WEIGHT: Record<NonNullable<ActionPolicy["minRole"]>, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
  service: 4,
};

export class CustomActionControlPlane {
  private readonly policies = new Map<string, ActionPolicy>();
  private readonly runbooks = new Map<string, Runbook>();
  private readonly identities = new Map<string, ShortLivedIdentity>();
  private readonly audit = new Map<string, ActionAuditEvent>();
  private readonly completed = new Map<string, unknown>();

  setPolicy(tenantId: string, policy: ActionPolicy): void {
    this.policies.set(tenantId, { ...policy, allowedActions: [...policy.allowedActions], deniedActions: [...(policy.deniedActions ?? [])] });
  }

  authorize(request: ActionRequest, actorRole: NonNullable<ActionPolicy["minRole"]> = "service"): ActionAuthorization {
    const requestId = request.requestId ?? randomUUID();
    const policy = this.policies.get(request.tenantId);
    if (!policy) return this.record({ ...request, requestId }, "DENY", "No tenant action policy is configured.");
    if (policy.deniedActions?.includes(request.action)) return this.record({ ...request, requestId }, "DENY", "Action explicitly denied by tenant policy.");
    if (!policy.allowedActions.includes(request.action)) return this.record({ ...request, requestId }, "DENY", "Action is not allowlisted by tenant policy.");
    if (policy.minRole && ROLE_WEIGHT[actorRole] < ROLE_WEIGHT[policy.minRole]) return this.record({ ...request, requestId }, "DENY", "Actor role is below the policy minimum.");
    if (policy.maxCostUsd !== undefined && (request.estimatedCostUsd ?? 0) > policy.maxCostUsd) return this.record({ ...request, requestId }, "DENY", "Estimated action cost exceeds policy budget.");
    if (request.environment === "production" && policy.productionApproval) return this.record({ ...request, requestId }, "ESCALATE", "Production execution requires explicit approval.");
    if ((request.risk ?? "low") === "critical") return this.record({ ...request, requestId }, "ESCALATE", "Critical-risk execution requires explicit approval.");
    return this.record({ ...request, requestId }, "ALLOW", "Action satisfies tenant policy and environment controls.");
  }

  registerRunbook(tenantId: string, id: string, version: number, steps: RunbookStep[]): Runbook {
    if (!steps.length) throw new Error("Runbook must contain at least one step.");
    const checksum = createHash("sha256").update(JSON.stringify({ id, version, tenantId, steps })).digest("hex");
    const runbook = { id, version, tenantId, steps: steps.map((s) => ({ ...s, parameters: { ...(s.parameters ?? {}) } })), checksum, active: true };
    this.runbooks.set(`${tenantId}:${id}`, runbook);
    return runbook;
  }

  getRunbook(tenantId: string, id: string): Runbook | undefined { return this.runbooks.get(`${tenantId}:${id}`); }

  issueIdentity(subject: string, audience: string, ttlSeconds = 300): ShortLivedIdentity {
    if (ttlSeconds <= 0 || ttlSeconds > 3600) throw new Error("Identity TTL must be between 1 and 3600 seconds.");
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + ttlSeconds;
    const token = createHash("sha256").update(`${subject}:${audience}:${issuedAt}:${randomUUID()}`).digest("hex");
    const identity = { subject, audience, issuedAt, expiresAt, token };
    this.identities.set(token, identity);
    return identity;
  }

  isIdentityValid(token: string, now = Math.floor(Date.now() / 1000)): boolean {
    const identity = this.identities.get(token);
    return Boolean(identity && now < identity.expiresAt);
  }

  async execute(request: ActionRequest, handler: () => Promise<unknown>, actorRole: NonNullable<ActionPolicy["minRole"]> = "service"): Promise<{ requestId: string; decision: ActionDecision; output?: unknown }> {
    const requestId = request.requestId ?? randomUUID();
    if (this.completed.has(requestId)) return { requestId, decision: "ALLOW", output: this.completed.get(requestId) };
    const authorization = this.authorize({ ...request, requestId }, actorRole);
    if (authorization.decision !== "ALLOW") return { requestId, decision: authorization.decision };
    const output = await handler();
    this.completed.set(requestId, output);
    return { requestId, decision: "ALLOW", output };
  }

  listAudit(tenantId?: string): ActionAuditEvent[] {
    const entries = [...this.audit.values()];
    return tenantId ? entries.filter((entry) => entry.tenantId === tenantId) : entries;
  }

  private record(request: ActionRequest, decision: ActionDecision, _reason: string): ActionAuthorization {
    const timestamp = new Date().toISOString();
    this.audit.set(request.requestId!, { id: randomUUID(), requestId: request.requestId!, tenantId: request.tenantId, actorId: request.actorId, action: request.action, resource: request.resource, environment: request.environment, decision, timestamp });
    return { decision, reason: _reason, requestId: request.requestId! };
  }
}

export const customActionControlPlane = new CustomActionControlPlane();
