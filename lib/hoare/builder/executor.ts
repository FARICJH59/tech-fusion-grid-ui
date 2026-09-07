import type { BuilderPlan, BuilderResourceKind } from "./types";

export type BuildProvider = "hoare" | "gcp" | "cloudflare" | "edge";

export type BuildOperation = {
  planId: string;
  resource: string;
  kind: BuilderResourceKind;
  provider: BuildProvider;
  action: "provision";
};

export type BuildResult = {
  planId: string;
  provider: BuildProvider;
  accepted: boolean;
  operations: BuildOperation[];
  message: string;
};

export interface BuildProviderAdapter {
  readonly provider: BuildProvider;
  canBuild(kind: BuilderResourceKind): boolean;
  provision(operation: BuildOperation): Promise<void>;
}

export class DryRunProviderAdapter implements BuildProviderAdapter {
  constructor(
    public readonly provider: BuildProvider,
    private readonly supportedKinds: readonly BuilderResourceKind[],
  ) {}

  canBuild(kind: BuilderResourceKind): boolean {
    return this.supportedKinds.includes(kind);
  }

  async provision(_operation: BuildOperation): Promise<void> {
    // Intentionally side-effect free. Real adapters are added behind this contract.
  }
}

export class BuilderExecutor {
  private readonly adapters = new Map<BuildProvider, BuildProviderAdapter>();

  register(adapter: BuildProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: BuildProvider): BuildProviderAdapter | null {
    return this.adapters.get(provider) ?? null;
  }

  async execute(plan: BuilderPlan): Promise<BuildResult> {
    if (plan.status !== "building") {
      throw new Error(`Builder execution requires building status; received ${plan.status}`);
    }

    const provider = plan.deployment.provider as BuildProvider;
    const adapter = this.get(provider);
    if (!adapter) throw new Error(`No build provider adapter registered for ${provider}`);

    const operations = plan.resources.map((resource) => ({
      planId: plan.id,
      resource: resource.name,
      kind: resource.kind,
      provider,
      action: "provision" as const,
    }));

    for (const operation of operations) {
      if (!adapter.canBuild(operation.kind)) {
        throw new Error(`Provider ${provider} cannot build resource kind ${operation.kind}`);
      }
      await adapter.provision(operation);
    }

    return {
      planId: plan.id,
      provider,
      accepted: true,
      operations,
      message: `Builder plan ${plan.id} executed through the ${provider} adapter.`,
    };
  }
}

export function buildDefaultExecutor(): BuilderExecutor {
  const executor = new BuilderExecutor();
  const allKinds: BuilderResourceKind[] = [
    "tenant", "domain", "infrastructure", "application", "api", "agent", "model", "workflow",
  ];
  for (const provider of ["hoare", "gcp", "cloudflare", "edge"] as const) {
    executor.register(new DryRunProviderAdapter(provider, allKinds));
  }
  return executor;
}
