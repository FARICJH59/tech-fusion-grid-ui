import type { FailoverResult } from "@/lib/dr/failover-controller";

export type RecoveryValidation = {
  tenantId: string;
  replicationHealthy: boolean;
  failoverHealthy: boolean;
  message: string;
};

export function runRecoveryTest(result: FailoverResult): RecoveryValidation {
  const pass = result.action === "stay" || (result.action === "evacuate" && result.validated);
  return {
    tenantId: result.tenantId,
    replicationHealthy: true,
    failoverHealthy: pass,
    message: pass ? "Recovery validation passed" : "Recovery validation failed",
  };
}
