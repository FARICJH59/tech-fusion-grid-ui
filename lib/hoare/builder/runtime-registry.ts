import type { BuildProviderAdapter } from "./executor";
import { BuilderExecutor } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";
import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";

export function registerRuntimeProvider(
  executor: BuilderExecutor,
  provider: RuntimeProvider,
  resolver: BuilderRuntimeResolver,
): BuildProviderAdapter {
  const adapter = new RuntimeProviderAdapter(provider, provider, resolver);
  executor.register(adapter);
  return adapter;
}
