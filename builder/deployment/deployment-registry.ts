import type { DeploymentAdapter, DeploymentTarget } from "./deployment-adapter";

/**
 * Provider-neutral adapter registry.
 *
 * HOARE owns target selection; adapters own provider-specific execution.
 * The registry deliberately stores adapter instances rather than cloud SDKs so
 * credentials and provider clients remain outside the builder contract.
 */
export class DeploymentAdapterRegistry {
  private readonly adapters = new Map<DeploymentTarget, DeploymentAdapter>();

  register(adapter: DeploymentAdapter): this {
    if (this.adapters.has(adapter.target)) {
      throw new Error(`DEPLOYMENT_ADAPTER_ALREADY_REGISTERED:${adapter.target}`);
    }
    this.adapters.set(adapter.target, adapter);
    return this;
  }

  get(target: DeploymentTarget): DeploymentAdapter {
    const adapter = this.adapters.get(target);
    if (!adapter) {
      throw new Error(`DEPLOYMENT_ADAPTER_NOT_REGISTERED:${target}`);
    }
    return adapter;
  }

  has(target: DeploymentTarget): boolean {
    return this.adapters.has(target);
  }

  targets(): DeploymentTarget[] {
    return [...this.adapters.keys()];
  }
}
