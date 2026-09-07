import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";
import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { BuildProviderAdapter, BuilderExecutor } from "./executor";
import { createRuntimeBackedAdapters } from "./runtime-adapter-factory";
import type { BuilderRuntimeResolver } from "./runtime-adapter";

export type RuntimeBuilderConfig = {
  providers: Partial<Record<"gcp" | "edge", RuntimeProvider>>;
  resolver: BuilderRuntimeResolver;
  authority: GovernedExecutionAuthority;
};

/**
 * Creates the live Builder adapter set from explicitly supplied runtime providers.
 * No provider means no live execution path for that provider. Live-capable adapters
 * require an issuer-created TCX authority at this composition boundary.
 */
export function createRuntimeBuilderAdapters(config: RuntimeBuilderConfig): BuildProviderAdapter[] {
  return createRuntimeBackedAdapters(config.providers, config.resolver, { authority: config.authority });
}

export function createRuntimeBuilderExecutor(
  config: RuntimeBuilderConfig,
  createExecutor: (adapters: BuildProviderAdapter[]) => BuilderExecutor,
): BuilderExecutor {
  return createExecutor(createRuntimeBuilderAdapters(config));
}
