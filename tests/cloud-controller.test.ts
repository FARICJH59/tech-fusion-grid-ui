import test from "node:test";
import assert from "node:assert/strict";

import { CloudRunController } from "../lib/cloud/cloud-run-controller";
import { DeploymentManager } from "../lib/cloud/deployment-manager";
import { IntelligentScalingEngine } from "../lib/cloud/scaling-engine";
import { RollbackEngine } from "../lib/cloud/rollback-engine";
import { AutonomousPolicyEngine } from "../lib/policy/engine";

function createMockCloud(healthy = true) {
  return {
    async deployService(spec: { service: string; region: string }) {
      return {
        service: spec.service,
        region: spec.region,
        latestRevision: `${spec.service}-r2`,
        traffic: [{ revision: `${spec.service}-r2`, percent: 100 }],
        status: "healthy" as const,
        observedAt: new Date().toISOString(),
      };
    },
    async updateTraffic(service: string, region: string, traffic: Array<{ revision: string; percent: number }>) {
      return {
        service,
        region,
        latestRevision: traffic[0].revision,
        traffic,
        status: "healthy" as const,
        observedAt: new Date().toISOString(),
      };
    },
    async getDeploymentStatus(service: string, region: string) {
      return {
        service,
        region,
        latestRevision: `${service}-r2`,
        traffic: [{ revision: `${service}-r2`, percent: 100 }],
        status: "healthy" as const,
        observedAt: new Date().toISOString(),
      };
    },
    async verifyHealth(service: string) {
      return {
        service,
        healthy,
        latencyMs: healthy ? 100 : 2000,
        errorRate: healthy ? 0.001 : 0.2,
        checkedAt: new Date().toISOString(),
      };
    },
  };
}

test("cloud controller deploys and verifies healthy rollout", async () => {
  const mockCloud = createMockCloud(true);
  const deploymentManager = new DeploymentManager();
  const policy = new AutonomousPolicyEngine([
    {
      id: "deploy-auto",
      version: 1,
      action: "deploy",
      maxRiskLevel: "high",
      allowAutoApprove: true,
      budgetGuardEnabled: true,
      requireTenantIsolation: true,
    },
  ]);
  const rollback = new RollbackEngine(mockCloud);
  const controller = new CloudRunController(
    mockCloud,
    deploymentManager,
    policy,
    new IntelligentScalingEngine(),
    rollback,
  );

  const result = await controller.deploy({
    deploymentId: "dep-1",
    tenantId: "tenant-1",
    requestedBy: "ops",
    reason: "release",
    spec: {
      service: "api",
      image: "gcr.io/test/api:v2",
      region: "us-central1",
      projectId: "proj",
    },
    riskLevel: "medium",
  });

  assert.equal(result.deployment.status, "completed");
  assert.equal(result.status.latestRevision, "api-r2");
  assert.equal(controller.listAuditTrail().length > 0, true);
});
