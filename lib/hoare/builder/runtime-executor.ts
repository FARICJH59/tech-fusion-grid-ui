import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";
import { BuilderExecutor, type BuildProviderAdapter } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";

export type RuntimeExecutorConfig = {
  gcp?: RuntimeProvider;
  edge?: RuntimeProvider;
  resolver: BuilderRuntimeResolver;
};

/**
 * Creates a Builder executor with only explicitly supplied live runtime providers.
 * Missing providers are not replaced with dry-run adapters.
 */
export function createRuntimeExecutor(config: RuntimeExecutorConfig): BuilderExecutor {
  const executor = new BuilderExecutor();
  const adapters: BuildProviderAdapter[] = [];

  if (config.gcp) adapters.push(new RuntimeProviderAdapter("gcp", config.gcp, config.resolver));
  if (config.edge) adapters.push(new RuntimeProviderAdapter("edge", config.edge, config.resolver));

  for (const adapter of adapters) executor.register(adapter);
  return executor;
}
