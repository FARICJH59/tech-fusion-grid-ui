export type ActionEffect = "ALLOW" | "DENY" | "ESCALATE";
export type Environment = "development" | "staging" | "production";

export type ActionRequest = {
  action: string;
  actor: string;
  tenantId: string;
  environment: Environment;
  parameters?: Record<string, unknown>;
};

export type ActionPolicy = {
  action: string;
  effect: ActionEffect;
  roles?: string[];
  environments?: Environment[];
};

export type RunbookStep = {
  id: string;
  action: string;
  parameters?: Record<string, unknown>;
};

export type Runbook = {
  name: string;
  version: number;
  tenantId: string;
  steps: RunbookStep[];
};

export type ActionDecision = {
  effect: ActionEffect;
  reason: string;
  request: ActionRequest;
  issuedAt: string;
};

export type ActionHandler = (request: ActionRequest, step: RunbookStep) => Promise<unknown>;

export class RunbookRegistry {
  private readonly items = new Map<string, Runbook>();

  register(runbook: Runbook): void {
    if (!runbook.name || !runbook.tenantId || !Number.isInteger(runbook.version) || runbook.version < 1) {
      throw new Error("Invalid runbook metadata");
    }
    if (!runbook.steps.length) throw new Error("Runbook requires at least one step");
    const key = `${runbook.tenantId}:${runbook.name}:v${runbook.version}`;
    this.items.set(key, structuredClone(runbook));
  }

  get(tenantId: string, name: string, version: number): Runbook | undefined {
    return this.items.get(`${tenantId}:${name}:v${version}`);
  }
}

export class EnvironmentGovernance {
  constructor(private readonly allowed: Record<Environment, string[]> = {
    development: ["*"],
    staging: ["*"],
    production: ["deploy.production", "observe.production", "rollback.production"],
  }) {}

  allows(environment: Environment, action: string): boolean {
    const actions = this.allowed[environment] ?? [];
    return actions.includes("*") || actions.includes(action);
  }
}

export class ActionAuthorizationEngine {
  constructor(private readonly policies: ActionPolicy[], private readonly governance = new EnvironmentGovernance()) {}

  decide(request: ActionRequest, role?: string): ActionDecision {
    const candidates = this.policies.filter((p) =>
      (p.action === request.action || p.action === "*") &&
      (!p.roles?.length || p.roles.includes(role ?? "")) &&
      (!p.environments?.length || p.environments.includes(request.environment)),
    );
    const policy = candidates[0];
    let effect: ActionEffect = policy?.effect ?? "ESCALATE";
    let reason = policy ? `Matched ${effect} action policy` : "No matching action policy";
    if (effect === "ALLOW" && !this.governance.allows(request.environment, request.action)) {
      effect = "ESCALATE";
      reason = "Environment governance requires escalation";
    }
    return { effect, reason, request, issuedAt: new Date().toISOString() };
  }
}

export class ShortLivedIdentityBroker {
  issue(request: ActionRequest, ttlSeconds = 300): { token: string; expiresAt: string; subject: string; tenantId: string } {
    if (!request.tenantId || !request.actor) throw new Error("Identity requires actor and tenant");
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const token = `hoare-ephemeral.${request.tenantId}.${request.actor}.${Date.now()}`;
    return { token, expiresAt, subject: request.actor, tenantId: request.tenantId };
  }
}

export class ActionExecutionPlane {
  constructor(private readonly auth: ActionAuthorizationEngine, private readonly identities = new ShortLivedIdentityBroker()) {}

  async execute(request: ActionRequest, step: RunbookStep, handler: ActionHandler, role?: string): Promise<{ decision: ActionDecision; identity?: ReturnType<ShortLivedIdentityBroker["issue"]>; result?: unknown }> {
    const decision = this.auth.decide(request, role);
    if (decision.effect !== "ALLOW") return { decision };
    const identity = this.identities.issue(request);
    const result = await handler(request, step);
    return { decision, identity, result };
  }
}
