import type { ApplicationResource, InfrastructureNode } from "@/lib/hoare/control-plane/types";
import type { RuntimeProvider, RuntimeProviderKind } from "@/lib/hoare/runtime/provider";
import type { BuildOperation, BuildProvider, BuildProviderAdapter } from "./executor";

const runtimeKinds: readonly BuildProvider[] = ["gcp", "edge"];

export type BuilderRuntimeResolver = {
  resolveApplication(operation: BuildOperation): Promise<ApplicationResource>;
  resolveNode(operation: BuildOperation): Promise<InfrastructureNode>;
};

function toRuntimeKind(provider: BuildProvider): RuntimeProviderKind {
  if (provider === "gcp") return "gcp";
  if (provider === "edge") return "edge";
  throw new Error(`Builder provider ${provider} has no RuntimeProvider mapping`);
}

export class RuntimeProviderAdapter implements BuildProviderAdapter {
  constructor(
    public readonly provider: BuildProvider,
    private readonly runtime: RuntimeProvider,
    private readonly resolver: BuilderRuntimeResolver,
  ) {
    if (!runtimeKinds.includes(provider)) {
      throw new Error(`Provider ${provider} cannot be backed by the HOARE runtime contract`);
    }
    if (runtime.kind !== toRuntimeKind(provider)) {
      throw new Error(`Runtime provider ${runtime.kind} does not match builder provider ${provider}`);
    }
  }

  canBuild(kind: BuildOperation["kind"]): boolean {
    return kind === "application";
  }

  async provision(operation: BuildOperation): Promise<void> {
    const application = await this.resolver.resolveApplication(operation);
    const node = await this.resolver.resolveNode(operation);
    const result = await this.runtime.deploy({ application, node });

    if (!result.accepted) {
      throw new Error(`Runtime provider rejected ${operation.resource}: ${result.message}`);
    }
  }
}
