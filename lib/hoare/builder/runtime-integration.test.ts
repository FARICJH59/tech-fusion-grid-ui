import { describe, expect, it } from "vitest";
import { BuilderExecutor } from "./executor";
import { RuntimeProviderAdapter } from "./runtime-adapter";
import { InMemoryBuilderResourceStore } from "./resource-store";
import { BuilderResourceResolver } from "./resource-resolver";
import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";

const tenant = { id: "tenant-1", name: "Test Tenant", status: "active" } as any;
const application = {
  id: "app-1", tenantId: "tenant-1", name: "demo-app", provider: "gcp", runtime: "cloud-run", status: "ready",
} as any;
const node = {
  id: "node-1", name: "gcp-node", provider: "gcp", region: "us-central1", status: "online",
} as any;

const plan = {
  id: "plan-1",
  intent: { tenantId: "tenant-1", name: "demo", description: "deploy demo-app", resources: ["infrastructure", "application"] },
  resources: [
    { kind: "infrastructure", name: "gcp-node", dependsOn: [] },
    { kind: "application", name: "demo-app", dependsOn: ["gcp-node"] },
  ],
  deployment: { provider: "gcp", environment: "development" },
  status: "building",
} as any;

describe("HOARE live runtime Builder integration", () => {
  it("resolves authoritative resources and invokes the runtime provider", async () => {
    const store = new InMemoryBuilderResourceStore();
    store.addTenant(tenant);
    store.addApplication(application);
    store.addInfrastructureNode(node);

    const resolver = new BuilderResourceResolver(store);
    let deployed = false;
    const runtime: RuntimeProvider = {
      kind: "gcp",
      async deploy(request) {
        deployed = request.application.id === "app-1" && request.node.id === "node-1";
        return {
          provider: "gcp",
          accepted: deployed,
          mode: "dry-run",
          deploymentId: "test-deployment",
          message: deployed ? "deployment accepted" : "invalid resources",
        };
      },
    };

    const adapter = new RuntimeProviderAdapter("gcp", runtime, {
      resolveApplication: (operation) => resolver.resolveApplication(operation, plan),
      resolveNode: (operation) => resolver.resolveInfrastructure(operation, plan),
    });

    const executor = new BuilderExecutor();
    executor.register(adapter);
    const result = await executor.execute(plan);

    expect(result.accepted).toBe(true);
    expect(deployed).toBe(true);
  });
});
