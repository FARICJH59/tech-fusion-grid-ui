import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";
import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { BuildProvider, BuildProviderAdapter } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";

export type RuntimeBackedAdapterOptions = {
  authority: GovernedExecutionAuthority;
};

export function createRuntimeBackedAdapter(
  provider: BuildProvider,
  runtime: RuntimeProvider,
  resolver: BuilderRuntimeResolver,
  options: RuntimeBackedAdapterOptions,
): BuildProviderAdapter {
  return new RuntimeProviderAdapter(provider, runtime, resolver, options.authority);
}

export function createRuntimeBackedAdapters(
  providers: Partial<Record<"gcp" | "edge", RuntimeProvider>>,
  resolver: BuilderRuntimeResolver,
  options: RuntimeBackedAdapterOptions,
): BuildProviderAdapter[] {
  return (Object.entries(providers) as Array<["gcp" | "edge", RuntimeProvider | undefined]>)
    .filter((entry): entry is ["gcp" | "edge", RuntimeProvider] => Boolean(entry[1]))
    .map(([provider, runtime]) => createRuntimeBackedAdapter(provider, runtime, resolver, options));
}
