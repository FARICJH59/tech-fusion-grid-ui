import { createHash } from "node:crypto";
import type { AegisPolicy, AegisRule } from "../aegis";
import { validatePolicy } from "../aegis";

export type AegisIR = Readonly<{
  name: string;
  version: number;
  rules: readonly AegisRule[];
  hash: string;
}>;

function stableHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function compileAegis(policy: AegisPolicy): AegisIR {
  validatePolicy(policy);
  const rules = policy.rules.map((rule) => ({
    ...rule,
    roles: rule.roles ? [...rule.roles] : undefined,
    environments: rule.environments ? [...rule.environments] : undefined,
  }));
  const canonical = JSON.stringify({ name: policy.name, version: policy.version, rules: policy.rules });
  return Object.freeze({ name: policy.name, version: policy.version, rules: Object.freeze(rules), hash: stableHash(canonical) });
}

export function parseAegis(source: string): AegisPolicy {
  const policy = JSON.parse(source) as AegisPolicy;
  validatePolicy(policy);
  return policy;
}
