import { AegisEffect, AegisPolicy, evaluatePolicy } from "../aegis";

export type SentinelDecision = AegisEffect;
export type SentinelRequest = {
  action: string;
  role?: string;
  environment?: string;
  tenantId?: string;
  context?: Record<string, unknown>;
};

export type SentinelResult = SentinelRequest & {
  decision: SentinelDecision;
  reason: string;
  timestamp: string;
};

export class Sentinel {
  constructor(private readonly policy: AegisPolicy) {}

  evaluate(request: SentinelRequest): SentinelResult {
    const decision = evaluatePolicy(this.policy, request);
    return {
      ...request,
      decision,
      reason: decision === "ALLOW" ? "Matched allow rule" : decision === "DENY" ? "Matched deny rule" : "No sufficiently specific authorization rule",
      timestamp: new Date().toISOString(),
    };
  }

  assertAllowed(request: SentinelRequest): SentinelResult {
    const result = this.evaluate(request);
    if (result.decision !== "ALLOW") throw new Error(`Sentinel ${result.decision}: ${result.reason}`);
    return result;
  }
}
