import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";
import type { AwsPreflight } from "./aws-preflight";
import type { AwsIamPolicyValidation } from "./aws-policy-validator";
import type { AwsDryRunEvidence } from "./dry-run-evidence";

export type AwsReadiness = Readonly<{
  decision: "ready-for-approval" | "blocked";
  reasons: string[];
}>;

export function evaluateAwsReadiness(preflight: AwsPreflight, policy: AwsIamPolicyValidation, iam: AwsIamDryRunPlan, evidence: AwsDryRunEvidence): AwsReadiness {
  const reasons: string[] = [];
  if (!preflight.ready) reasons.push("aws-readiness:preflight");
  if (!policy.valid) reasons.push("aws-readiness:policy");
  if (!iam.compliant) reasons.push("aws-readiness:iam");
  if (!evidence.verification.verified) reasons.push("aws-readiness:evidence");
  return { decision: reasons.length === 0 ? "ready-for-approval" : "blocked", reasons };
}
