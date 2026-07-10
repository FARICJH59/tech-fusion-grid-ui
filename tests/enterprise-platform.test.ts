import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultControlPlane,
  CONTROL_PLANE_MODULES,
} from "../lib/enterprise/control-plane";
import { RuntimeIntegration, RUNTIME_SERVICES } from "../lib/enterprise/runtime";
import {
  createAIProviderGateway,
  PROVIDER_NAMES,
  type ProviderAdapter,
} from "../lib/enterprise/providers";
import {
  createDefaultInfrastructure,
  type InfrastructureAdapter,
} from "../lib/enterprise/infrastructure";
import { createDefaultAgentFramework } from "../lib/enterprise/agents";
import { createGoogleCloudProfile, GOOGLE_CLOUD_SERVICES } from "../lib/enterprise/cloud";
import { createDefaultSDKRegistry } from "../lib/enterprise/sdk";
import { createDefaultMarketplace } from "../lib/enterprise/marketplace";
import { EnterpriseSecurity } from "../lib/enterprise/security";
import { RevenuePlatform } from "../lib/enterprise/revenue";
import { hoareEnterprisePlatform } from "../lib/enterprise/platform";

test("control plane includes all required enterprise modules", () => {
  const controlPlane = buildDefaultControlPlane();
  const moduleNames = controlPlane.list().map((item) => item.name);

  assert.equal(moduleNames.length, CONTROL_PLANE_MODULES.length);
  for (const required of CONTROL_PLANE_MODULES) {
    assert.ok(moduleNames.includes(required));
  }
});

test("runtime integration exposes all deployable runtime services", () => {
  const runtime = new RuntimeIntegration();

  assert.equal(runtime.list().length, RUNTIME_SERVICES.length);
  assert.equal(runtime.getHealth(), "healthy");

  runtime.setHealth("Health Manager", "degraded");
  assert.equal(runtime.getHealth(), "degraded");
});

test("provider gateway supports failover, retries, and usage accounting", async () => {
  const gateway = createAIProviderGateway();
  gateway.setHealth("Google Gemini", "down");

  const response = await gateway.execute({
    operation: "text",
    prompt: "Generate an enterprise response",
    tenantId: "tenant-1",
    preferred: "Google Gemini",
    retries: 1,
  });

  assert.notEqual(response.provider, "Google Gemini");
  const usage = gateway.usageSnapshot();
  assert.equal(usage[response.provider].requests, 1);
  assert.ok(usage[response.provider].costUsd > 0);
});

test("provider gateway streams through unified provider interface", async () => {
  const gateway = createAIProviderGateway();
  const chunks: string[] = [];

  for await (const chunk of gateway.stream({
    operation: "multimodal",
    prompt: "Analyze image and summarize",
    tenantId: "tenant-2",
  })) {
    chunks.push(chunk.chunk);
  }

  assert.ok(chunks.length >= 2);
});

test("infrastructure adapters can be replaced without business logic changes", () => {
  const infra = createDefaultInfrastructure();
  const replacement: InfrastructureAdapter = {
    component: "Object Storage",
    vendor: "s3-compatible",
    region: "us-east1",
    health: "healthy",
    metadata: { replaceable: "true", strategy: "adapter-contract" },
  };

  infra.replace("Object Storage", replacement);
  assert.equal(infra.get("Object Storage")?.vendor, "s3-compatible");
});

test("agent framework supports templates, lifecycle, workflows, and memory", () => {
  const framework = createDefaultAgentFramework();

  framework.createAgent({
    id: "agent-a",
    templateId: "runtime-operator",
    version: "1.0.0",
    status: "active",
    approvalsRequired: true,
  });

  framework.startWorkflow({
    id: "run-1",
    agentId: "agent-a",
    status: "running",
    events: ["started"],
    memory: {},
  });

  framework.appendEvent("run-1", "approval-requested");
  framework.writeMemory("run-1", "ticket", "INC-001");
  framework.updateLifecycle("agent-a", "paused");

  assert.equal(framework.listAgents()[0].status, "paused");
  assert.equal(framework.listWorkflows()[0].memory.ticket, "INC-001");
});

test("google cloud profile is standardized for required project and services", () => {
  const cloud = createGoogleCloudProfile();

  assert.equal(cloud.projectId, "caramel-limiter-495010-b9");
  for (const service of GOOGLE_CLOUD_SERVICES) {
    assert.equal(cloud.services[service].enabled, true);
  }
});

test("enterprise SDK registry exposes TypeScript and Python SDKs across channels", () => {
  const sdk = createDefaultSDKRegistry().list();
  const names = sdk.map((item) => item.name);

  assert.deepEqual(names.sort(), ["Python SDK", "TypeScript SDK"]);
  assert.ok(sdk.every((item) => item.channels.includes("REST") && item.channels.includes("MQTT")));
});

test("marketplace registry supports extension catalog", () => {
  const marketplace = createDefaultMarketplace();

  assert.ok(marketplace.list().some((item) => item.type === "Industry Packs"));
});

test("enterprise security enforces RBAC + ABAC + tenant isolation", () => {
  const security = new EnterpriseSecurity();

  assert.equal(
    security.isAuthorized({
      role: "admin",
      requiredRole: "operator",
      tenantId: "t-1",
      resourceTenantId: "t-1",
      attributes: { scope: "admin" },
    }),
    true,
  );

  assert.equal(
    security.isAuthorized({
      role: "viewer",
      requiredRole: "operator",
      tenantId: "t-1",
      resourceTenantId: "t-1",
    }),
    false,
  );
});

test("revenue platform performs usage metering and cost aggregation", () => {
  const revenue = new RevenuePlatform();
  revenue.record({
    tenantId: "tenant-a",
    aiCostUsd: 1.25,
    gpuSeconds: 30,
    marketplaceCostUsd: 0.75,
    requests: 12,
  });

  const snapshot = revenue.snapshot("tenant-a");

  assert.equal(snapshot.totalCostUsd, 2);
  assert.equal(snapshot.requests, 12);
  assert.equal(snapshot.gpuSeconds, 30);
});

test("platform singleton aggregates all enterprise layers", () => {
  const status = hoareEnterprisePlatform.status();

  assert.equal(status.architecture.providers.length, PROVIDER_NAMES.length);
  assert.equal(status.cloud.projectId, "caramel-limiter-495010-b9");
  assert.equal(status.health.controlPlane, "healthy");
});

test("provider gateway supports custom adapters without provider leakage", async () => {
  const gateway = createAIProviderGateway();

  const customAdapter: ProviderAdapter = {
    name: "OpenAI",
    health: "healthy",
    supports: ["text"],
    async call() {
      return {
        provider: "OpenAI",
        output: "custom-openai",
        usageTokens: 5,
        estimatedCostUsd: 0.01,
      };
    },
    async *stream() {
      yield { provider: "OpenAI", chunk: "custom", done: true };
    },
  };

  gateway.register(customAdapter);
  const response = await gateway.execute({
    operation: "text",
    prompt: "hello",
    tenantId: "tenant-z",
    preferred: "OpenAI",
  });

  assert.equal(response.output, "custom-openai");
});
