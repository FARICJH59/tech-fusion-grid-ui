import type { HoareExecutionResult } from "./execution-engine";

export type VerificationCheck =
  | "identity-policy"
  | "tenant-isolation"
  | "https-tls"
  | "health"
  | "audit-evidence";

export interface VerificationObservation {
  check: VerificationCheck;
  status: "pass" | "fail";
  detail: string;
}

export interface HoareEvidenceBundle {
  schema: "hoare.evidence/v1";
  executionStatus: HoareExecutionResult["status"];
  observations: VerificationObservation[];
  verified: boolean;
  immutableRecordRequired: true;
}

export function verifyExecution(
  execution: HoareExecutionResult,
  observations: VerificationObservation[],
): HoareEvidenceBundle {
  const verified =
    execution.status === "ready" &&
    observations.length > 0 &&
    observations.every((observation) => observation.status === "pass");

  return {
    schema: "hoare.evidence/v1",
    executionStatus: execution.status,
    observations: [...observations],
    verified,
    immutableRecordRequired: true,
  };
}

export function canCloseDeployment(evidence: HoareEvidenceBundle): boolean {
  const required: VerificationCheck[] = [
    "identity-policy",
    "tenant-isolation",
    "https-tls",
    "health",
    "audit-evidence",
  ];

  return (
    evidence.verified &&
    required.every((check) =>
      evidence.observations.some(
        (observation) => observation.check === check && observation.status === "pass",
      ),
    )
  );
}
