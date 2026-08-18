import { randomBytes, randomUUID } from "node:crypto";

export type ActionEffect = "ALLOW" | "DENY" | "ESCALATE";
export type Environment = "development" | "staging" | "production";

export type ActionRequest = {
  action: string;
  actor: string;
  tenantId: string;
  environment: Environment;
  requestId?: string;
  parameters?: Record<string, unknown>;
};

export type ActionPolicy = {
  action: string;
  effect: ActionEffect;
  roles?: string[];
  environments?: Environment[];
};

export type RunbookStep = { id: string; action: string; parameters?: Record<string, unknown> };
export type Runbook = { name: string; version: number; tenantId: string; steps: RunbookStep[] };
export type ActionDecision = { effect: ActionEffect; reason: string; request: ActionRequest; issuedAt: string };
export type ActionHandler = (request: ActionRequest, step: RunbookStep) => Promise<unknown>;

export class RunbookRegistry {
  private readonly items = new Map<string, Runbook>();
  register(runbook: Runbook): void {
    if (!runbook.name || !runbook.tenantId || !Number.isInteger(runbook.version) || runbook.version < 1) throw new Error("Invalid runbook metadata");
    if (!runbook.steps.length) throw new Error("Runbook requires at least one step");
    this.items.set(`${runbook.tenantId}:${runbook.name}:v${runbook.version}`, structuredClone(runbook));
  }
  get(tenantId: string, name: string, version: number): Runbook | undefined { return this.items.get(`${tenantId}:${name}:v${version}`); }
}

export class EnvironmentGovernance {
  constructor(private readonly allowed: Record<Environment, string[]> = { development: ["*"], staging: ["*"], production: ["deploy.production", "observe.production", "rollback.production"] }) {}
  allows(environment: Environment, action: string): boolean {
    const actions = this.allowed[environment] ?? [];
    return actions.includes("*") || actions.includes(action);
  }
}

export class ActionAuthorizationEngine {
  constructor(private readonly policies: ActionPolicy[], private readonly governance = new EnvironmentGovernance()) {}
  decide(request: ActionRequest, role?: string): ActionDecision {
    const candidates = this.policies.filter((p) => (p.action === request.action || p.action === "*") && (!p.roles?.length || p.roles.includes(role ?? "")) && (!p.environments?.length || p.environments.includes(request.environment)));
    const policy = candidates[0];
    let effect: ActionEffect = policy?.effect ?? "ESCALATE";
    let reason = policy ? `Matched ${effect} action policy` : "No matching action policy";
    if (effect === "ALLOW" && !this.governance.allows(request.environment, request.action)) { effect = "ESCALATE"; reason = "Environment governance requires escalation"; }
    return { effect, reason, request: { ...request, requestId: request.requestId ?? randomUUID() }, issuedAt: new Date().toISOString() };
  }
}

export class ShortLivedIdentityBroker {
  issue(request: ActionRequest, ttlSeconds = 300): { token: string; expiresAt: string; subject: string; tenantId: string; issuedAt: string } {
    if (!request.tenantId || !request.actor) throw new Error("Identity requires actor and tenant");
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) throw new Error("Identity TTL must be between 1 and 3600 seconds");
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
    const token = `hoare-ephemeral.${randomBytes(32).toString("base64url")}`;
    return { token, expiresAt: expiresAt.toISOString(), subject: request.actor, tenantId: request.tenantId, issuedAt: issuedAt.toISOString() };
  }
}

export class ActionExecutionPlane {
  private readonly completed = new Map<string, unknown>();
  constructor(private readonly auth: ActionAuthorizationEngine, private readonly identities = new ShortLivedIdentityBroker()) {}
  async execute(request: ActionRequest, step: RunbookStep, handler: ActionHandler, role?: string): Promise<{ decision: ActionDecision; identity?: ReturnType<ShortLivedIdentityBroker["issue"]>; result?: unknown }> {
    const requestId = request.requestId ?? randomUUID();
    if (this.completed.has(requestId)) return { decision: { effect: "ALLOW", reason: "Replay-safe request already completed", request: { ...request, requestId }, issuedAt: new Date().toISOString() }, result: this.completed.get(requestId) };
    const normalized = { ...request, requestId };
    const decision = this.auth.decide(normalized, role);
    if (decision.effect !== "ALLOW") return { decision };
    const identity = this.identities.issue(normalized);
    const result = await handler(normalized, step);
    this.completed.set(requestId, result);
    return { decision, identity, result };
  }
}
