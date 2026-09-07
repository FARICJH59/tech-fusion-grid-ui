import type { RollbackEngine } from "@/lib/cloud/rollback-engine";
import type { IncidentManager } from "@/lib/incidents/incident-manager";
import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";

export class RemediationLoop {
  constructor(
    private readonly incidents: IncidentManager,
    private readonly rollback: RollbackEngine,
  ) {}

  async run(input: {
    incidentId: string;
    tenantId: string;
    service: string;
    region: string;
    fromRevision: string;
    toRevision: string;
    errorRate: number;
    latencyMs: number;
    authority?: GovernedExecutionAuthority;
  }): Promise<"rolled-back" | "monitoring"> {
    const requiresRollback = input.errorRate > 0.05 || input.latencyMs > 1200;

    if (!requiresRollback) {
      this.incidents.verify(input.incidentId, true);
      return "monitoring";
    }

    if (!input.authority) throw new Error("tcx_authority_required_for_live_remediation");

    await this.rollback.execute({
      tenantId: input.tenantId,
      service: input.service,
      region: input.region,
      fromRevision: input.fromRevision,
      toRevision: input.toRevision,
      trigger: input.errorRate > 0.05 ? "error-rate" : "latency-regression",
      reason: "Remediation loop triggered autonomous rollback",
      authority: input.authority,
    });

    this.incidents.remediate(input.incidentId, "Autonomous rollback executed");
    this.incidents.verify(input.incidentId, true);
    this.incidents.resolve(input.incidentId);
    return "rolled-back";
  }
}
