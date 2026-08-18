import { AegisPolicy, AegisRule, validatePolicy } from "../aegis";

export type AegisIR = Readonly<{
  name: string;
  version: number;
  rules: readonly AegisRule[];
  hash: string;
}>;

function stableHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function compileAegis(policy: AegisPolicy): AegisIR {
  validatePolicy(policy);
  const canonical = JSON.stringify({ name: policy.name, version: policy.version, rules: policy.rules });
  return Object.freeze({ name: policy.name, version: policy.version, rules: Object.freeze([...policy.rules]), hash: stableHash(canonical) });
}

export function parseAegis(source: string): AegisPolicy {
  const policy = JSON.parse(source) as AegisPolicy;
  validatePolicy(policy);
  return policy;
}
