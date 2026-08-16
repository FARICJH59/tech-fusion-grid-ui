import type { BuildProviderAdapter } from "./executor";
import { BuilderExecutor } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";
import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";

function toBuildProvider(provider: RuntimeProvider): "gcp" | "edge" {
  if (provider.kind === "gcp") return "gcp";
  if (provider.kind === "edge") return "edge";
  throw new Error(`Runtime provider ${provider.kind} has no builder provider mapping`);
}

export function registerRuntimeProvider(
  executor: BuilderExecutor,
  provider: RuntimeProvider,
  resolver: BuilderRuntimeResolver,
): BuildProviderAdapter {
  const buildProvider = toBuildProvider(provider);
  const adapter = new RuntimeProviderAdapter(buildProvider, provider, resolver);
  executor.register(adapter);
  return adapter;
}
