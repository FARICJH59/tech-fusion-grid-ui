import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";
import type { BuildProvider, BuildProviderAdapter } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";

export function createRuntimeBackedAdapter(
  provider: BuildProvider,
  runtime: RuntimeProvider,
  resolver: BuilderRuntimeResolver,
): BuildProviderAdapter {
  return new RuntimeProviderAdapter(provider, runtime, resolver);
}

export function createRuntimeBackedAdapters(
  providers: Partial<Record<"gcp" | "edge", RuntimeProvider>>,
  resolver: BuilderRuntimeResolver,
): BuildProviderAdapter[] {
  return (Object.entries(providers) as Array<["gcp" | "edge", RuntimeProvider | undefined]>)
    .filter((entry): entry is ["gcp" | "edge", RuntimeProvider] => Boolean(entry[1]))
    .map(([provider, runtime]) => createRuntimeBackedAdapter(provider, runtime, resolver));
}
