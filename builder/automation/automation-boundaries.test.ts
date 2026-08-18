import assert from "node:assert/strict";
import test from "node:test";
import { authorizeAction } from "./action-authorization";
import { EnvironmentManager } from "./environment-manager";
import { InMemoryExecutionCoordinator, executionKey } from "./execution-coordinator";
import { RunbookRegistry } from "./runbook-registry";
import { assertShortLivedCredential } from "./identity-broker";

const policy = {
  allowedActions: ["deploy", "restart", "rollback"],
  autonomousRisks: ["low", "medium"],
  approvalRequiredRisks: ["high"],
} as const;

test("authorization allows low-risk allowlisted actions", () => {
  assert.deepEqual(authorizeAction({
    tenantId: "tenant-1",
    projectId: "project-1",
    environment: "staging",
    action: "deploy",
    risk: "low",
    requestedBy: "hoare",
    policy,
  }), { decision: "ALLOW", reason: "ACTION_AUTHORIZED" });
});

test("authorization escalates high-risk actions", () => {
  const result = authorizeAction({
    tenantId: "tenant-1",
    projectId: "project-1",
    environment: "production",
    action: "rollback",
    risk: "high",
    requestedBy: "hoare",
    policy,
  });
  assert.equal(result.decision, "ESCALATE");
});

test("production environment requires approval for destructive actions", () => {
  const manager = new EnvironmentManager([{
    environment: "production",
    autonomous: true,
    approvalRequiredActions: ["rollback"],
    destructiveActions: ["delete"],
  }]);
  assert.equal(manager.evaluate("production", "rollback").requiresApproval, true);
  assert.equal(manager.evaluate("production", "delete").allowed, false);
});

test("execution coordinator prevents conflicting concurrent work", async () => {
  const coordinator = new InMemoryExecutionCoordinator();
  const key = executionKey("tenant-1", "checkout", "deploy-1");
  assert.ok(await coordinator.acquire(key, "agent-a", 60_000));
  assert.equal(await coordinator.acquire(key, "agent-b", 60_000), null);
  await coordinator.release(key, "agent-a");
  assert.ok(await coordinator.acquire(key, "agent-b", 60_000));
});

test("runbook registry is reusable and versioned", async () => {
  const registry = new RunbookRegistry();
  registry.register({
    name: "deploy-cloud-run",
    version: "1",
    description: "Governed Cloud Run deployment",
    inputs: ["service", "image"],
    execute: async (input) => input,
  });
  const result = await registry.get("deploy-cloud-run", "1").execute({ service: "api" });
  assert.deepEqual(result, { service: "api" });
});

test("identity boundary rejects expired credentials", () => {
  assert.throws(() => assertShortLivedCredential({
    provider: "gcp",
    token: "short-lived-token",
    expiresAt: "2020-01-01T00:00:00Z",
    permissions: ["run.services.update"],
  }), /IDENTITY_CREDENTIAL_EXPIRED/);
});
