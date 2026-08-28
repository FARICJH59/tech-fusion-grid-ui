import type { AwsIamDryRunPlan } from "./aws-iam-dry-run";
import type { HoareEvidenceBundle, VerificationObservation } from "./evidence-verifier";

export interface DryRunEvidence {
  schema: "hoare.provider-dry-run-evidence/v1";
  provider: "aws";
  iamPlan: AwsIamDryRunPlan;
  observations: VerificationObservation[];
  evidence: HoareEvidenceBundle;
  mutationExecuted: false;
}

export function createAwsDryRunEvidence(
  iamPlan: AwsIamDryRunPlan,
  observations: VerificationObservation[],
  evidence: HoareEvidenceBundle,
): DryRunEvidence {
  if (iamPlan.mode !== "dry-run" || iamPlan.mutationAllowed) {
    throw new Error("Only non-mutating AWS dry-run plans can enter evidence");
  }

  return {
    schema: "hoare.provider-dry-run-evidence/v1",
    provider: "aws",
    iamPlan,
    observations: [...observations],
    evidence,
    mutationExecuted: false,
  };
}

export function isAdmissibleDryRunEvidence(record: DryRunEvidence): boolean {
  return (
    record.provider === "aws" &&
    record.iamPlan.mode === "dry-run" &&
    record.iamPlan.mutationAllowed === false &&
    record.mutationExecuted === false &&
    record.evidence.immutableRecordRequired === true
  );
}
