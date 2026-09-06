import test from "node:test";
import assert from "node:assert/strict";

import { CloudRunController } from "../lib/cloud/cloud-run-controller";
import { DeploymentManager } from "../lib/cloud/deployment-manager";
import { IntelligentScalingEngine } from "../lib/cloud/scaling-engine";
import { RollbackEngine } from "../lib/cloud/rollback-engine";
import { AutonomousPolicyEngine } from "../lib/policy/engine";
import type { GovernedExecutionAuthority } from "../lib/hoare/runtime/governed-execution-authority";

function createAuthority(tenantId: string): GovernedExecutionAuthority {
  return {
    transactionId: "tx-1",
    attemptId: "attempt-1",
    tenantId,
    leaseId: "lease-1",
    stateVersion: 3,
    authorizationDecisionId: "decision-1",
    verificationProofId: "proof-1",
    async assertValid() {},
  };
}

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

test("cloud controller deploys and verifies healthy rollout only with TCX authority", async () => {
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
    authority: createAuthority("tenant-1"),
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

test("cloud controller fails closed before live deploy without TCX authority", async () => {
  const mockCloud = createMockCloud(true);
  let deployCalls = 0;
  const guardedCloud = {
    ...mockCloud,
    async deployService(spec: { service: string; region: string }) {
      deployCalls += 1;
      return mockCloud.deployService(spec);
    },
  };
  const controller = new CloudRunController(
    guardedCloud,
    new DeploymentManager(),
    new AutonomousPolicyEngine([{
      id: "deploy-auto",
      version: 1,
      action: "deploy",
      maxRiskLevel: "high",
      allowAutoApprove: true,
      budgetGuardEnabled: true,
      requireTenantIsolation: true,
    }]),
    new IntelligentScalingEngine(),
    new RollbackEngine(mockCloud),
  );

  await assert.rejects(
    controller.deploy({
      deploymentId: "dep-no-auth",
      tenantId: "tenant-1",
      requestedBy: "ops",
      reason: "release",
      spec: { service: "api", image: "gcr.io/test/api:v2", region: "us-central1", projectId: "proj" },
    }),
    /tcx_authority_required_for_live_cloud_controller_deploy/,
  );
  assert.equal(deployCalls, 0);
});

test("traffic migration fails closed without TCX authority", async () => {
  const mockCloud = createMockCloud(true);
  let trafficCalls = 0;
  const guardedCloud = {
    ...mockCloud,
    async updateTraffic(service: string, region: string, traffic: Array<{ revision: string; percent: number }>) {
      trafficCalls += 1;
      return mockCloud.updateTraffic(service, region, traffic);
    },
  };
  const controller = new CloudRunController(
    guardedCloud,
    new DeploymentManager(),
    new AutonomousPolicyEngine([]),
    new IntelligentScalingEngine(),
    new RollbackEngine(mockCloud),
  );

  await assert.rejects(
    controller.migrateTraffic("api", "us-central1", [{ revision: "api-r2", percent: 100 }]),
    /tcx_authority_required_for_live_cloud_traffic_migration/,
  );
  assert.equal(trafficCalls, 0);
});

test("traffic migration uses tenant-bound TCX authority", async () => {
  const mockCloud = createMockCloud(true);
  const controller = new CloudRunController(
    mockCloud,
    new DeploymentManager(),
    new AutonomousPolicyEngine([]),
    new IntelligentScalingEngine(),
    new RollbackEngine(mockCloud),
  );

  const status = await controller.migrateTraffic(
    "api",
    "us-central1",
    [{ revision: "api-r2", percent: 100 }],
    createAuthority("tenant-1"),
  );
  assert.equal(status.latestRevision, "api-r2");
  assert.equal(controller.listAuditTrail()[0]?.tenantId, "tenant-1");
});
