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
  intent: { tenantId: "tenant-1", description: "deploy demo-app" },
  resources: [
    { kind: "infrastructure", name: "gcp-node", dependsOn: [] },
    { kind: "application", name: "demo-app", dependsOn: ["gcp-node"] },
  ],
  status: "approved",
  operations: [
    { id: "op-1", kind: "application", resource: "demo-app", provider: "gcp", status: "pending" },
  ],
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
      provider: "gcp",
      async deploy(request: any) {
        deployed = request.application.id === "app-1" && request.node.id === "node-1";
        return { accepted: deployed, message: deployed ? "deployment accepted" : "invalid resources" };
      },
    } as RuntimeProvider;

    const adapter = new RuntimeProviderAdapter("gcp", runtime, {
      resolveApplication: (name, p) => resolver.resolveApplication({ resource: name, kind: "application" } as any, p),
      resolveInfrastructure: (name, p) => resolver.resolveInfrastructure({ resource: name, kind: "infrastructure" } as any, p),
      resolvePlan: async () => plan,
    } as any);

    const executor = new BuilderExecutor([adapter]);
    const result = await executor.execute(plan);

    expect(result.success).toBe(true);
    expect(deployed).toBe(true);
  });
});
