import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";
import type { EvidenceObservation, ExecutionEvidenceBundle } from "./evidence-verifier";

export type AwsDryRunEvidence = Readonly<{
  schema: "hoare.aws-dry-run-evidence/v1";
  iam: AwsIamDryRunPlan;
  observations: EvidenceObservation[];
  verification: ExecutionEvidenceBundle;
  status: "verified" | "blocked";
}>;

export function createAwsDryRunEvidence(iam: AwsIamDryRunPlan, observations: EvidenceObservation[], verification: ExecutionEvidenceBundle): AwsDryRunEvidence {
  return { schema: "hoare.aws-dry-run-evidence/v1", iam, observations, verification, status: verification.verified ? "verified" : "blocked" };
}
