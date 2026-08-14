import { createHash } from "node:crypto";
import { RemediationCommand, RemediationContext, RemediationHandlerRegistry } from "./remediation-handlers";

export interface SelfHealingUnit {
  unitId: string;
  tenantId: string;
  target: string;
  incidentId: string;
  command: RemediationCommand;
  parameters: Record<string, unknown>;
  simulationAllowed: boolean;
  governanceAllowed: boolean;
  provenanceVerified: boolean;
  quotaAvailable: boolean;
  recoveryExpected: boolean;
}

export interface SelfHealingResult {
  unitId: string;
  status: "RECOVERED" | "DENIED" | "FAILED";
  reason: string;
  actionId?: string;
  provenanceId: string;
  billable: boolean;
}

export interface RecoveryVerifier {
  verify(unit: SelfHealingUnit, actionId: string): Promise<boolean>;
}

export interface Meter {
  record(event: { unitId: string; tenantId: string; actionId: string; billable: boolean }): Promise<void>;
}

export function deterministicUnitId(unit: Omit<SelfHealingUnit, "unitId">): string {
  return createHash("sha256").update(JSON.stringify(unit)).digest("hex");
}

export class ClosedLoopSelfHealingOrchestrator {
  constructor(
    private readonly handlers: RemediationHandlerRegistry,
    private readonly verifier: RecoveryVerifier,
    private readonly meter: Meter,
  ) {}

  async execute(unitInput: Omit<SelfHealingUnit, "unitId">): Promise<SelfHealingResult> {
    const unit: SelfHealingUnit = { unitId: deterministicUnitId(unitInput), ...unitInput };
    const provenanceId = createHash("sha256")
      .update(JSON.stringify({ unitId: unit.unitId, incidentId: unit.incidentId, command: unit.command }))
      .digest("hex");

    if (!unit.simulationAllowed) return { unitId: unit.unitId, status: "DENIED", reason: "SIMULATION_DENIED", provenanceId, billable: false };
    if (!unit.governanceAllowed) return { unitId: unit.unitId, status: "DENIED", reason: "GOVERNANCE_DENIED", provenanceId, billable: false };
    if (!unit.provenanceVerified) return { unitId: unit.unitId, status: "DENIED", reason: "PROVENANCE_UNVERIFIED", provenanceId, billable: false };
    if (!unit.quotaAvailable) return { unitId: unit.unitId, status: "DENIED", reason: "QUOTA_UNAVAILABLE", provenanceId, billable: false };

    const context: RemediationContext = {
      tenantId: unit.tenantId,
      target: unit.target,
      incidentId: unit.incidentId,
      parameters: unit.parameters,
    };
    const action = await this.handlers.execute(unit.command, context);
    const recovered = await this.verifier.verify(unit, action.actionId);

    if (!recovered) {
      return {
        unitId: unit.unitId,
        status: "FAILED",
        reason: "RECOVERY_VERIFICATION_FAILED",
        actionId: action.actionId,
        provenanceId,
        billable: false,
      };
    }

    await this.meter.record({
      unitId: unit.unitId,
      tenantId: unit.tenantId,
      actionId: action.actionId,
      billable: true,
    });

    return {
      unitId: unit.unitId,
      status: "RECOVERED",
      reason: "RECOVERY_VERIFIED",
      actionId: action.actionId,
      provenanceId,
      billable: true,
    };
  }
}
