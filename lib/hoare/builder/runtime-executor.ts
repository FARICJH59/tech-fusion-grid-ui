import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";
import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import { BuilderExecutor, type BuildProviderAdapter } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";

export type RuntimeExecutorConfig = {
  gcp?: RuntimeProvider;
  edge?: RuntimeProvider;
  resolver: BuilderRuntimeResolver;
  authority?: GovernedExecutionAuthority;
};

/**
 * Creates a Builder executor with only explicitly supplied live runtime providers.
 * Missing providers are not replaced with dry-run adapters. Live-capable providers
 * require an issuer-created TCX authority at construction time.
 */
export function createRuntimeExecutor(config: RuntimeExecutorConfig): BuilderExecutor {
  const executor = new BuilderExecutor();
  const adapters: BuildProviderAdapter[] = [];

  if (config.gcp) adapters.push(new RuntimeProviderAdapter("gcp", config.gcp, config.resolver, config.authority));
  if (config.edge) adapters.push(new RuntimeProviderAdapter("edge", config.edge, config.resolver, config.authority));

  for (const adapter of adapters) executor.register(adapter);
  return executor;
}
