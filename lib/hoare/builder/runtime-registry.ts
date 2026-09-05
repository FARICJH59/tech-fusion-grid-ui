import type { BuildProviderAdapter } from "./executor";
import { BuilderExecutor } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";
import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";

export function registerRuntimeProvider(
  executor: BuilderExecutor,
  provider: RuntimeProvider,
  resolver: BuilderRuntimeResolver,
): BuildProviderAdapter {
  if (provider.kind !== "gcp" && provider.kind !== "edge") {
    throw new Error(`Runtime provider ${provider.kind} cannot be registered as a builder provider`);
  }
  const adapter = new RuntimeProviderAdapter(provider.kind, provider, resolver);
  executor.register(adapter);
  return adapter;
}
