import type { ApplicationResource, InfrastructureNode } from "@/lib/hoare/control-plane/types";
import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
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
    private readonly authority?: GovernedExecutionAuthority,
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

    // liveCapable defaults to true. Only an explicitly dry-run-only provider
    // may be invoked without TCX authority. This check happens before the
    // provider call so a provider cannot perform a mutation and report it
    // afterward as an unauthorized live result.
    if (this.runtime.liveCapable !== false && !this.authority) {
      throw new Error("tcx_authority_required_for_live_runtime_adapter");
    }

    const result = await this.runtime.deploy({ application, node, authority: this.authority });

    if (result.mode === "live" && !this.authority) {
      throw new Error("tcx_authority_required_for_live_runtime_adapter");
    }

    if (!result.accepted) {
      throw new Error(`Runtime provider rejected ${operation.resource}: ${result.message}`);
    }
  }
}
