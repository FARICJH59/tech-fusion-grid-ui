import assert from "node:assert/strict";
import test from "node:test";

import { createHoareBuilderPlan } from "../lib/enterprise/hoare-builder-planner";
import {
  compileProviderAdapterPlan,
  isSafeProviderAdapterPlan,
} from "../lib/enterprise/provider-adapters";

test("provider adapters translate HOARE IAM intent without taking provider ownership", () => {
  const builderPlan = createHoareBuilderPlan({
    tenantId: "tenant-a",
    projectId: "project-a",
    description: "Build a secure document translation service",
    environment: "production",
    providers: ["aws", "gcp", "azure"],
    autonomy: "approval",
  });

  for (const iamPlan of builderPlan.iam) {
    const adapterPlan = compileProviderAdapterPlan(iamPlan);
    assert.equal(adapterPlan.identityMechanism, "temporary");
    assert.equal(adapterPlan.requiresProviderAuthorization, true);
    assert.ok(adapterPlan.explicitDenials.includes("iam.*"));
    assert.ok(adapterPlan.explicitDenials.includes("long-lived-credentials"));
    assert.equal(isSafeProviderAdapterPlan(adapterPlan), true);
  }
});

test("provider adapter rejects an unsafe IAM wildcard", () => {
  const unsafe = {
    provider: "aws" as const,
    identityMechanism: "temporary" as const,
    permissions: [{ action: "iam.*", scope: "provider" as const }],
    explicitDenials: ["long-lived-credentials"],
    requiresProviderAuthorization: true as const,
  };

  assert.equal(isSafeProviderAdapterPlan(unsafe), false);
});
