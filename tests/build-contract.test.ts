import test from "node:test";
import assert from "node:assert/strict";
import {
  createBuildContract,
  validateBuildContract,
  type BuildContract,
} from "@/lib/enterprise/build-contract";

const base: Omit<BuildContract, "version" | "lifecycle"> = {
  id: "build-001",
  tenant: { organizationId: "org-1", tenantId: "tenant-1", userId: "user-1" },
  application: "payments-api",
  intent: "deploy payments API to production",
  target: {
    provider: "gcp",
    runtime: "cloud-run",
    region: "us-central1",
    environment: "production",
  },
  risk: "medium",
  approvalMode: "approval-required",
  requiredCapabilities: ["deploy", "observe", "rollback"],
  security: {
    zeroTrust: true,
    phishingResistantMfa: true,
    devicePosture: true,
    mtls: true,
    tenantIsolation: true,
  },
  observability: {
    auditLog: true,
    telemetry: true,
    tracing: true,
    incidentDetection: true,
  },
  policyIds: ["production-deploy"],
  infrastructureLayer: "cloud",
  adapter: "google-cloud-run",
  rollbackRequired: true,
  metadata: { source: "build-pack" },
};

test("creates a valid HOARE build contract", () => {
  const contract = createBuildContract(base);
  assert.equal(contract.version, "1.0");
  assert.equal(contract.lifecycle, "draft");
  assert.equal(validateBuildContract(contract).valid, true);
});

test("rejects critical automatic execution", () => {
  const contract = createBuildContract({ ...base, risk: "medium" });
  const result = validateBuildContract({
    ...contract,
    risk: "critical",
    approvalMode: "automatic",
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Critical builds cannot use automatic/);
});

test("requires rollback and observability for high-risk builds", () => {
  const contract = createBuildContract(base);
  const result = validateBuildContract({
    ...contract,
    risk: "high",
    rollbackRequired: false,
    observability: {
      ...contract.observability,
      auditLog: false,
      incidentDetection: false,
    },
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
});
