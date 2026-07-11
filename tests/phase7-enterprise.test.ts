import test from "node:test";
import assert from "node:assert/strict";

import { createGoogleCloudProfile } from "../lib/enterprise/cloud";
import { createWifConfig, PHASE7_GCP_SDKS } from "../lib/enterprise/cloud-runtime";
import { CostOptimizationEngine } from "../lib/enterprise/cost-engine";
import { createDefaultFleetManager } from "../lib/enterprise/fleet";
import { createDefaultIntegrationLayer, ENTERPRISE_CONNECTORS } from "../lib/enterprise/integrations";
import { EnterpriseMessagingRuntime } from "../lib/enterprise/messaging";
import { autonomousScalingEngine } from "../lib/enterprise/scaling";
import { hoareEnterprisePlatform } from "../lib/enterprise/platform";

test("phase7 cloud profile uses WIF and official GCP SDK contracts", () => {
  const profile = createGoogleCloudProfile();
  const wif = createWifConfig();

  assert.equal(profile.projectId, "caramel-limiter-495010-b9");
  assert.equal(profile.auth.mode, "workload-identity-federation");
  assert.equal(profile.auth.provider, wif.poolProvider);
  assert.deepEqual(profile.sdkIntegrations, PHASE7_GCP_SDKS);
});

test("phase7 cost engine emits optimization recommendations", () => {
  const engine = new CostOptimizationEngine();
  engine.ingest({
    tenantId: "tenant-1",
    promptTokens: 100,
    completionTokens: 500,
    embeddingsTokens: 120_000,
    imageGenerations: 10,
    videoGenerations: 5,
    gpuSeconds: 25_000,
    cloudRunVcpuSeconds: 20_000,
    cloudRunMemoryGbSeconds: 20_000,
    estimatedCostUsd: 23.4,
  });

  const recommendations = engine.recommend("tenant-1");
  assert.ok(recommendations.length >= 4);
});

test("phase7 autonomous scaling transforms cloud run plan", () => {
  const plan = autonomousScalingEngine.applyRecommendations(
    [
      {
        tenantId: "tenant-1",
        category: "cloud-run-concurrency",
        priority: "high",
        message: "tune",
      },
    ],
    {
      minInstances: 1,
      maxInstances: 3,
      concurrency: 20,
      cpu: "2",
      memory: "2Gi",
      region: "us-east1",
    },
  );

  assert.ok(plan.concurrency >= 80);
  assert.ok(plan.maxInstances >= 3);
});

test("phase7 fleet manager supports multi-region failover", () => {
  const fleet = createDefaultFleetManager();
  const placement = fleet.placeWorkload({
    tenantId: "tenant-1",
    requiredCapacity: 20,
    latencySensitive: true,
  });

  assert.ok(placement.primary.length > 0);
  assert.ok(placement.failover.length > 0);
});

test("phase7 integration layer registers connector plugins", async () => {
  const layer = createDefaultIntegrationLayer();
  const names = layer.list();
  assert.equal(names.length, ENTERPRISE_CONNECTORS.length);

  const result = await layer.run("GitHub", {
    tenantId: "tenant-1",
    actorId: "user-1",
    payload: { event: "sync" },
  });

  assert.equal(result.status, "success");
});

test("phase7 messaging runtime enforces ACL checks and dead-letter route", () => {
  const messaging = new EnterpriseMessagingRuntime();
  messaging.setTenantAcl("tenant-1", [
    { tenantId: "tenant-1", topic: "tenant/1/events", access: "readwrite" },
  ]);

  assert.equal(messaging.canAccess("tenant-1", "tenant/1/events", "read"), true);
  assert.equal(messaging.canAccess("tenant-1", "tenant/1/secret", "read"), false);
  assert.equal(messaging.toDeadLetter("tenant/1/events", "payload", "retry-exceeded").route.length > 0, true);
});

test("phase7 platform status exposes new enterprise layer capabilities", () => {
  const status = hoareEnterprisePlatform.status();

  assert.ok(status.architecture.runtimeStateEntities.includes("workflows"));
  assert.ok(status.architecture.redisCapabilities.includes("runtime-coordination"));
  assert.ok(status.architecture.integrationConnectors.includes("ServiceNow"));
  assert.ok(status.architecture.notificationChannels.includes("slack"));
});
