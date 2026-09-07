import type {
  CloudActionEvent,
  CloudRunRevisionStatus,
  CloudRunServiceSpec,
  DeploymentRecord,
  ScalingDecision,
} from "@/lib/cloud/cloud-types";
import type { DeploymentManager } from "@/lib/cloud/deployment-manager";
import type { RollbackEngine } from "@/lib/cloud/rollback-engine";
import type { IntelligentScalingEngine } from "@/lib/cloud/scaling-engine";
import type { GcpCloudClient } from "@/lib/cloud/gcp-client";
import type { AutonomousPolicyEngine } from "@/lib/policy/engine";
import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import { cloudActionEventBus } from "@/lib/cloud/action-events";
import { traceAutonomousWorkflow } from "@/lib/telemetry/autonomous-observability";

export class CloudRunController {
  private readonly auditTrail: CloudActionEvent[] = [];

  constructor(
    private readonly cloudClient: Pick<GcpCloudClient, "deployService" | "updateTraffic" | "verifyHealth" | "getDeploymentStatus">,
    private readonly deploymentManager: DeploymentManager,
    private readonly policyEngine: AutonomousPolicyEngine,
    private readonly scalingEngine: IntelligentScalingEngine,
    private readonly rollbackEngine: RollbackEngine,
  ) {}

  async deploy(input: {
    deploymentId: string;
    tenantId: string;
    requestedBy: string;
    reason: string;
    spec: CloudRunServiceSpec;
    riskLevel?: "low" | "medium" | "high" | "critical";
    authority?: GovernedExecutionAuthority;
  }): Promise<{ deployment: DeploymentRecord; status: CloudRunRevisionStatus }> {
    return traceAutonomousWorkflow("cloud-deployment", async () => {
      const deployment = this.deploymentManager.request({
        id: input.deploymentId,
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        service: input.spec.service,
        region: input.spec.region,
        targetImage: input.spec.image,
        previousRevision: `${input.spec.service}-previous`,
      });

      this.deploymentManager.transition(deployment.id, "validated", "Pre-deployment checks passed");

      const policyEvent: CloudActionEvent = {
        id: deployment.id,
        tenantId: input.tenantId,
        actionType: "deploy",
        resource: input.spec.service,
        requestedBy: input.requestedBy,
        reason: input.reason,
        riskLevel: input.riskLevel ?? "medium",
        previousState: { revision: deployment.previousRevision },
        newState: { image: input.spec.image },
        approvalStatus: "pending",
        executionStatus: "validated",
        timestamp: new Date().toISOString(),
      };
      await cloudActionEventBus.publish(policyEvent);

      const decision = this.policyEngine.evaluate(policyEvent);
      if (decision.decision === "reject") {
        this.deploymentManager.transition(deployment.id, "rolled-back", "Policy rejected deployment");
        const rejectedEvent: CloudActionEvent = {
          ...policyEvent,
          approvalStatus: decision.approvalStatus,
          executionStatus: decision.executionStatus,
          reason: decision.reason,
        };
        this.auditTrail.push(rejectedEvent);
        await cloudActionEventBus.publish(rejectedEvent);
        throw new Error(decision.reason);
      }

      this.deploymentManager.transition(deployment.id, "approved", decision.reason);
      this.deploymentManager.transition(deployment.id, "deploying", "Cloud Run rollout started");

      if (!input.authority) {
        throw new Error("tcx_authority_required_for_live_cloud_controller_deploy");
      }
      if (input.authority.tenantId !== input.tenantId) {
        throw new Error("tcx_authority_tenant_mismatch");
      }
      await input.authority.assertValid();
      const status = await this.cloudClient.deployService(input.spec);
      this.deploymentManager.setRevision(deployment.id, status.latestRevision);
      this.deploymentManager.transition(deployment.id, "verifying", "Verifying deployment health");

      const health = await this.cloudClient.verifyHealth(input.spec.service);
      if (!health.healthy) {
        await this.rollbackEngine.execute({
          tenantId: input.tenantId,
          service: input.spec.service,
          region: input.spec.region,
          fromRevision: status.latestRevision,
          toRevision: deployment.previousRevision ?? `${input.spec.service}-stable`,
          trigger: "failed-health-check",
          reason: "Health verification failed after rollout",
          authority: input.authority,
        });
        this.deploymentManager.transition(deployment.id, "rolled-back", "Automatic rollback executed");
      } else {
        this.deploymentManager.transition(deployment.id, "completed", "Deployment verification succeeded");
      }

      const completedEvent: CloudActionEvent = {
        id: deployment.id,
        tenantId: input.tenantId,
        actionType: "deploy",
        resource: input.spec.service,
        requestedBy: input.requestedBy,
        reason: input.reason,
        riskLevel: input.riskLevel ?? "medium",
        previousState: { revision: deployment.previousRevision },
        newState: { revision: status.latestRevision, image: input.spec.image },
        approvalStatus: decision.approvalStatus,
        executionStatus: health.healthy ? "completed" : "rolled-back",
        timestamp: new Date().toISOString(),
      };
      this.auditTrail.push(completedEvent);
      await cloudActionEventBus.publish(completedEvent);

      return {
        deployment: this.deploymentManager.get(deployment.id) ?? deployment,
        status,
      };
    });
  }

  async migrateTraffic(
    service: string,
    region: string,
    revisions: Array<{ revision: string; percent: number }>,
    authority?: GovernedExecutionAuthority,
  ) {
    if (!authority) {
      throw new Error("tcx_authority_required_for_live_cloud_traffic_migration");
    }
    if (!authority.tenantId) {
      throw new Error("tcx_authority_tenant_required");
    }
    await authority.assertValid();
    const status = await this.cloudClient.updateTraffic(service, region, revisions);
    this.auditTrail.push({
      id: `${authority.tenantId}:${service}:traffic:${Date.now().toString(36)}`,
      tenantId: authority.tenantId,
      actionType: "traffic-migration",
      resource: service,
      requestedBy: "cloud-controller",
      reason: "Traffic migration requested",
      riskLevel: "medium",
      previousState: {},
      newState: { traffic: revisions },
      approvalStatus: "approved",
      executionStatus: "completed",
      timestamp: new Date().toISOString(),
    });
    return status;
  }

  evaluateScaling(signal: Parameters<IntelligentScalingEngine["decide"]>[0]): ScalingDecision {
    return this.scalingEngine.decide(signal);
  }

  async deploymentStatus(service: string, region: string): Promise<CloudRunRevisionStatus> {
    return this.cloudClient.getDeploymentStatus(service, region);
  }

  listAuditTrail(): CloudActionEvent[] {
    return [...this.auditTrail, ...this.rollbackEngine.listAudit()];
  }
}
