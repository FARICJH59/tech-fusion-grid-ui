import type { AwsPreflightResult } from "./aws-preflight";
import type { AwsPolicyValidationResult } from "./aws-policy-validator";
import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";
import { isSafeAwsIamDryRun } from "./aws-iam-dry-run";
import type { DryRunEvidence } from "./dry-run-evidence";
import { isAdmissibleDryRunEvidence } from "./dry-run-evidence";

export interface AwsReadinessGateResult {
  provider: "aws";
  decision: "ready-for-approval" | "blocked";
  checks: Record<string, "pass" | "fail">;
  reasons: string[];
  mutationAllowed: false;
}

export function evaluateAwsReadiness(
  preflight: AwsPreflightResult,
  policy: AwsPolicyValidationResult,
  iamPlan: AwsIamDryRunPlan,
  evidence: DryRunEvidence,
): AwsReadinessGateResult {
  const checks: Record<string, "pass" | "fail"> = {
    preflight: preflight.status === "ready" ? "pass" : "fail",
    policy: policy.status === "pass" ? "pass" : "fail",
    dryRun: isSafeAwsIamDryRun(iamPlan) ? "pass" : "fail",
    evidence: isAdmissibleDryRunEvidence(evidence) && evidence.evidence.verified ? "pass" : "fail",
    noMutation: iamPlan.mutationAllowed === false && evidence.mutationExecuted === false ? "pass" : "fail",
  };

  const reasons = Object.entries(checks)
    .filter(([, value]) => value === "fail")
    .map(([check]) => `aws-readiness:${check}`);

  return {
    provider: "aws",
    decision: reasons.length ? "blocked" : "ready-for-approval",
    checks,
    reasons,
    mutationAllowed: false,
  };
}

export function isReadyForApproval(result: AwsReadinessGateResult): boolean {
  return result.decision === "ready-for-approval" && result.mutationAllowed === false && Object.values(result.checks).every((value) => value === "pass");
}
