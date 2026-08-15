import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";
import type { BuildProviderAdapter, BuilderExecutor } from "./executor";
import { createRuntimeBackedAdapters } from "./runtime-adapter-factory";
import type { BuilderRuntimeResolver } from "./runtime-adapter";

export type RuntimeBuilderConfig = {
  providers: Partial<Record<"gcp" | "edge", RuntimeProvider>>;
  resolver: BuilderRuntimeResolver;
};

/**
 * Creates the live Builder adapter set from explicitly supplied runtime providers.
 * No provider means no live execution path for that provider.
 */
export function createRuntimeBuilderAdapters(config: RuntimeBuilderConfig): BuildProviderAdapter[] {
  return createRuntimeBackedAdapters(config.providers, config.resolver);
}

export function createRuntimeBuilderExecutor(
  config: RuntimeBuilderConfig,
  createExecutor: (adapters: BuildProviderAdapter[]) => BuilderExecutor,
): BuilderExecutor {
  return createExecutor(createRuntimeBuilderAdapters(config));
}
