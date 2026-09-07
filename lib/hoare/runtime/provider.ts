import type { ApplicationResource, InfrastructureNode } from "@/lib/hoare/control-plane/types";
import type { GovernedExecutionAuthority } from "./governed-execution-authority";

export type RuntimeProviderKind = "gcp" | "bare-metal" | "edge";

export interface RuntimeDeploymentRequest {
  application: ApplicationResource;
  node: InfrastructureNode;
  /** Required by any provider that can perform a live side effect. */
  authority?: GovernedExecutionAuthority;
}

export type RuntimeDeploymentResult = {
  provider: RuntimeProviderKind;
  accepted: boolean;
  mode: "dry-run" | "live";
  deploymentId: string;
  message: string;
};

export interface RuntimeProvider {
  readonly kind: RuntimeProviderKind;
  /** Secure default: providers are assumed live-capable unless explicitly dry-run-only. */
  readonly liveCapable?: boolean;
  deploy(request: RuntimeDeploymentRequest): Promise<RuntimeDeploymentResult>;
}

export class ProviderRegistry {
  private readonly providers = new Map<RuntimeProviderKind, RuntimeProvider>();

  register(provider: RuntimeProvider): void {
    this.providers.set(provider.kind, provider);
  }

  get(kind: RuntimeProviderKind): RuntimeProvider | undefined {
    return this.providers.get(kind);
  }
}

export class DryRunRuntimeProvider implements RuntimeProvider {
  readonly liveCapable = false;
  constructor(public readonly kind: RuntimeProviderKind) {}

  async deploy(request: RuntimeDeploymentRequest): Promise<RuntimeDeploymentResult> {
    return {
      provider: this.kind,
      accepted: true,
      mode: "dry-run",
      deploymentId: `dryrun-${request.application.id}-${request.node.id}`,
      message: `Deployment plan accepted by ${this.kind} runtime adapter; live execution is not enabled.`,
    };
  }
}

export function buildRuntimeProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new DryRunRuntimeProvider("gcp"));
  registry.register(new DryRunRuntimeProvider("bare-metal"));
  registry.register(new DryRunRuntimeProvider("edge"));
  return registry;
}
