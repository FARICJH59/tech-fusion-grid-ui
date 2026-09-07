import assert from "node:assert/strict";
import test from "node:test";
import { getCloudflareDomainConfig } from "@/lib/hoare/network/cloudflare-domain";
import { executeAutonomousBuildOverHttp } from "@/lib/hoare/autonomous-build/http";

function fakeAuthority() {
  return {
    transactionId: "tx-1",
    attemptId: "attempt-1",
    tenantId: "tenant-1",
    leaseId: "lease-1",
    stateVersion: 4,
    authorizationDecisionId: "decision-1",
    verificationProofId: "proof-1",
    assertValid: async () => undefined,
  } as never;
}

test("Cloudflare domain config requires explicit hostname and zone", () => {
  assert.equal(getCloudflareDomainConfig({}), null);
  assert.deepEqual(
    getCloudflareDomainConfig({ HOARE_PUBLIC_DOMAIN: "HOARE.example.com.", CLOUDFLARE_ZONE_ID: "zone-1" }),
    { hostname: "hoare.example.com", zoneId: "zone-1" },
  );
});

test("HTTP autonomous build adapter preserves provider result", async () => {
  const provider = {
    target: "github" as const,
    execute: async () => ({
      target: "github" as const,
      accepted: true,
      executionId: "execution-1",
      message: "accepted",
    }),
  };

  const result = await executeAutonomousBuildOverHttp(provider, {
    repository: "FARICJH59/example",
    ref: "main",
    workflow: "ci.yml",
    projectId: "project-1",
    tenantId: "tenant-1",
    transactionId: "tx-1",
    attemptId: "attempt-1",
    authority: fakeAuthority(),
  });

  assert.deepEqual(result, {
    accepted: true,
    target: "github",
    executionId: "execution-1",
    message: "accepted",
  });
});
