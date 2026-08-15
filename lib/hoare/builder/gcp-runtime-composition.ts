import { GcpCloudClient } from "@/lib/cloud/gcp-client";
import { GcpRuntimeProvider } from "@/lib/hoare/runtime/gcp-provider";
import { createRuntimeBuilderExecutor } from "./runtime-integration";
import type { BuilderRuntimeResolver } from "./runtime-adapter";
import type { BuilderExecutor } from "./executor";

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

  return createRuntimeBuilderExecutor(
    { providers: { gcp: runtime }, resolver: options.resolver },
    (adapters) => {
      // The concrete executor factory is injected by the application composition root.
      throw new Error(`Builder executor factory is required to install ${adapters.length} runtime adapter(s)`);
    },
  );
}
