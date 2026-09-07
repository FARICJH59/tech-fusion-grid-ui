import { GcpCloudClient } from "@/lib/cloud/gcp-client";
import type { CloudRunServiceSpec } from "@/lib/cloud/cloud-types";
import { assertTcxExecutionAuthority } from "./governed-execution-authority";
import type { RuntimeDeploymentRequest, RuntimeDeploymentResult, RuntimeProvider } from "./provider";

export class GcpRuntimeProvider implements RuntimeProvider {
  readonly kind = "gcp" as const;

  constructor(private readonly client: GcpCloudClient) {}

  async deploy(request: RuntimeDeploymentRequest): Promise<RuntimeDeploymentResult> {
    const authority = request.authority;
    if (!authority) throw new Error("tcx_authority_required_for_live_gcp_execution");
    assertTcxExecutionAuthority(authority);
    if (authority.tenantId !== request.application.tenantId) throw new Error("tcx_authority_tenant_mismatch");
    if (!authority.transactionId || !authority.attemptId || !authority.leaseId) throw new Error("tcx_authority_identity_incomplete");
    if (!authority.authorizationDecisionId || !authority.verificationProofId) throw new Error("tcx_authority_proof_binding_required");

    const image = (request.application as typeof request.application & { image?: unknown }).image;
    if (typeof image !== "string" || image.trim().length === 0) throw new Error("application_image_required_for_gcp");

    const spec: CloudRunServiceSpec = {
      service: request.application.id,
      region: this.client.region,
      projectId: this.client.projectId,
      image,
      revisionSuffix: Date.now().toString(36),
    };

    // The client is itself a mutation boundary and repeats the final authority
    // validation immediately before invoking the Cloud Run SDK.
    const result = await this.client.deployService(spec, authority);

    return {
      provider: this.kind,
      accepted: true,
      mode: "live",
      deploymentId: result.latestRevision,
      message: `Cloud Run deployment submitted for ${request.application.id}.`,
    };
  }
}
