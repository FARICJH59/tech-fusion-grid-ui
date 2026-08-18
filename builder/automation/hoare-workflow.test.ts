import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionAdapterRegistry } from "./workflow-compiler";
import { GcpWorkflowAdapter, GitHubActionsWorkflowAdapter } from "./workflow-adapters";
import { HoareWorkflowRegistry, validateHoareWorkflow, type HoareWorkflow } from "./hoare-workflow";

const workflow: HoareWorkflow = {
  name: "deploy-service",
  version: "1",
  trigger: { type: "customer.intent", intent: "deploy my application" },
  environment: "production",
  policy: "production-deployment",
  executionTarget: "gcp",
  actions: [
    { id: "build", action: "build", version: "1", risk: "low" },
    { id: "deploy", action: "deploy-cloud-run", version: "1", needs: ["build"], risk: "medium" },
    { id: "verify", action: "health-check", version: "1", needs: ["deploy"], risk: "low" },
  ],
  verification: ["deployment-health", "revision-ready"],
  rollback: "rollback-cloud-run",
};

test("native HOARE workflow validates independently of execution provider", () => {
  assert.doesNotThrow(() => validateHoareWorkflow(workflow));
});

test("workflow registry versions native workflows", () => {
  const registry = new HoareWorkflowRegistry();
  registry.register(workflow);
  assert.equal(registry.get("deploy-service", "1").name, "deploy-service");
});

test("adapter registry can target GCP or GitHub Actions", async () => {
  const adapters = new ExecutionAdapterRegistry()
    .register(new GcpWorkflowAdapter())
    .register(new GitHubActionsWorkflowAdapter());

  assert.equal((await adapters.compile(workflow, "gcp")).adapter, "gcp");
  assert.equal((await adapters.compile(workflow, "github-actions")).adapter, "github-actions");
});

test("unknown execution targets are rejected", async () => {
  const adapters = new ExecutionAdapterRegistry().register(new GcpWorkflowAdapter());
  await assert.rejects(() => adapters.compile(workflow, "unknown"), /EXECUTION_ADAPTER_NOT_FOUND/);
});

test("workflow dependencies must reference existing actions", () => {
  const invalid = { ...workflow, actions: [{ ...workflow.actions[0], needs: ["missing"] }] };
  assert.throws(() => validateHoareWorkflow(invalid), /WORKFLOW_UNKNOWN_DEPENDENCY/);
});
