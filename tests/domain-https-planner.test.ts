import assert from "node:assert/strict";
import test from "node:test";

import { createDeploymentPlan, isSafeDeploymentPlan } from "../lib/enterprise/domain-https-planner";

test("public HOARE deployments require HTTPS and tenant-aware routing", () => {
  const plan = createDeploymentPlan({
    tenantId: "tenant-a",
    projectId: "project-a",
    description: "Secure enterprise API",
    environment: "production",
    providers: ["aws"],
    domain: "api.example.test",
    autonomy: "policy-autonomous",
  });

  assert.equal(plan.domainHttps.exposure, "public");
  assert.equal(plan.domainHttps.tls, "required");
  assert.equal(plan.domainHttps.certificate, "managed");
  assert.equal(plan.domainHttps.routing, "tenant-aware");
  assert.equal(plan.approval, "required");
  assert.equal(isSafeDeploymentPlan(plan), true);
});

test("internal development deployments remain private by default", () => {
  const plan = createDeploymentPlan({
    tenantId: "tenant-b",
    projectId: "project-b",
    description: "Internal agent service",
    environment: "development",
    autonomy: "policy-autonomous",
  });

  assert.equal(plan.domainHttps.exposure, "internal");
  assert.equal(plan.domainHttps.tls, "not-required");
  assert.equal(plan.infrastructure.network, "private-by-default");
  assert.equal(plan.infrastructure.storage, "tenant-scoped");
  assert.equal(plan.approval, "policy-authorized");
  assert.equal(isSafeDeploymentPlan(plan), true);
});

test("a public endpoint without TLS is rejected", () => {
  const unsafe = {
    schema: "hoare.deployment-plan/v1" as const,
    infrastructure: {
      compute: "provider-selected" as const,
      network: "private-by-default" as const,
      storage: "tenant-scoped" as const,
      secrets: "managed-secret-store" as const,
      observability: "enabled" as const,
    },
    domainHttps: {
      exposure: "public" as const,
      domain: "api.example.test",
      tls: "not-required" as const,
      certificate: "none" as const,
      routing: "tenant-aware" as const,
    },
    approval: "required" as const,
    verification: ["audit-evidence-capture"],
  };

  assert.equal(isSafeDeploymentPlan(unsafe), false);
});
