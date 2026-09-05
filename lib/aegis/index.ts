export type AegisEffect = "ALLOW" | "DENY" | "ESCALATE";

export type AegisRule = {
  action: string;
  effect: AegisEffect;
  roles?: string[];
  environments?: string[];
};

export type AegisPolicy = {
  name: string;
  version: number;
  rules: AegisRule[];
};

const VALID_EFFECTS = new Set<AegisEffect>(["ALLOW", "DENY", "ESCALATE"]);

export function validatePolicy(policy: AegisPolicy): void {
  if (!policy.name || !Number.isInteger(policy.version) || policy.version < 1) throw new Error("Invalid AEGIS policy metadata");
  if (!Array.isArray(policy.rules) || policy.rules.length === 0) throw new Error("AEGIS policy requires at least one rule");
  for (const rule of policy.rules) {
    if (!rule.action || !VALID_EFFECTS.has(rule.effect)) throw new Error(`Invalid AEGIS rule: ${rule.action}`);
  }
}

export function evaluatePolicy(policy: AegisPolicy, input: { action: string; role?: string; environment?: string }): AegisEffect {
  validatePolicy(policy);
  const rule = policy.rules.find((candidate) => {
    if (candidate.action !== input.action && candidate.action !== "*") return false;
    if (candidate.roles?.length && !candidate.roles.includes(input.role ?? "")) return false;
    if (candidate.environments?.length && !candidate.environments.includes(input.environment ?? "")) return false;
    return true;
  });
  return rule?.effect ?? "ESCALATE";
}
