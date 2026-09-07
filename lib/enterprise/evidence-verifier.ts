export type EvidenceObservation = Readonly<{
  check: "identity-policy" | "tenant-isolation" | "https-tls" | "health" | "audit-evidence";
  status: "pass" | "fail";
  detail: string;
}>;

export type ExecutionEvidenceBundle = Readonly<{
  status: "ready" | "blocked";
  completedStages: string[];
  providerPlans: unknown[];
  reasons: string[];
  observations: EvidenceObservation[];
  verified: boolean;
}>;

export function verifyExecution(base: Omit<ExecutionEvidenceBundle, "observations" | "verified">, observations: EvidenceObservation[]): ExecutionEvidenceBundle {
  const failed = observations.filter((item) => item.status !== "pass");
  const reasons = [...base.reasons, ...failed.map((item) => `evidence:${item.check}`)];
  return { ...base, status: failed.length === 0 && base.status === "ready" ? "ready" : "blocked", observations, verified: failed.length === 0 };
}
