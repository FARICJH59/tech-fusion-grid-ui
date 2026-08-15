import type { ApplicationResource, InfrastructureNode } from "@/lib/hoare/control-plane/types";

export type RuntimeProviderKind = "gcp" | "bare-metal" | "edge";

export interface RuntimeDeploymentRequest {
  application: ApplicationResource;
  node: InfrastructureNode;
}

export interface RuntimeDeploymentResult {
  provider: RuntimeProviderKind;
  accepted: boolean;
  mode: "dry-run" | "live";
  deploymentId: string;
  message: string;
}

export interface RuntimeProvider {
  readonly kind: RuntimeProviderKind;
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
