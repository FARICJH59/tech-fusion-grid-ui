import { GcpCloudClient } from "@/lib/cloud/gcp-client";
import { GcpRuntimeProvider } from "@/lib/hoare/runtime/gcp-provider";
import { BuilderExecutor } from "./executor";
import { RuntimeProviderAdapter, type BuilderRuntimeResolver } from "./runtime-adapter";

export type GcpRuntimeCompositionOptions = {
  resolver: BuilderRuntimeResolver;
  projectId?: string;
  region?: string;
};

/**
 * Production composition boundary for GCP. Authentication is delegated to
 * GcpCloudClient/createWifConfig; the Builder receives no credentials.
 */
export async function createGcpRuntimeBuilderExecutor(
  options: GcpRuntimeCompositionOptions,
): Promise<BuilderExecutor> {
  const client = await GcpCloudClient.create({
    projectId: options.projectId,
    region: options.region,
  });
  const runtime = new GcpRuntimeProvider(client);
  const executor = new BuilderExecutor();
  executor.register(new RuntimeProviderAdapter("gcp", runtime, options.resolver));
  return executor;
}
