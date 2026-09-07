import type { BuilderPlan } from "./types";
import type { BuildProviderAdapter } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";
import type { RuntimeProvider } from "@/lib/hoare/runtime/provider";

export function createRuntimeBackedBuilderAdapter(
  provider: "gcp" | "edge",
  runtime: RuntimeProvider,
  resolver: BuilderRuntimeResolver,
): BuildProviderAdapter {
  return new RuntimeProviderAdapter(provider, runtime, resolver);
}

export type BuilderPlanResolver = (planId: string) => Promise<BuilderPlan>;
