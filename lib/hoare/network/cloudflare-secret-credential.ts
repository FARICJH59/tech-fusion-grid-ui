import type { CloudflareSecretCredentialRequest } from "./cloudflare-edge-provider";
import type { GcpSecretManagerProvider } from "@/lib/hoare/secrets/gcp-secret-manager-provider";

/**
 * Adapts the governed Secret Manager capability boundary to the Cloudflare
 * mutation boundary. The Cloudflare token is materialized only at the final
 * external-call boundary and is never placed in the capability itself.
 */
export class CloudflareSecretCredentialResolver {
  constructor(private readonly secrets: GcpSecretManagerProvider) {}

  async resolve(request: CloudflareSecretCredentialRequest): Promise<string | undefined> {
    const material = await this.secrets.getSecretWithCapability(request.capability, request.access);
    if (material.secretId !== request.capability.secretId) {
      throw new Error("cloudflare_secret_capability_secret_mismatch");
    }
    return material.value;
  }
}
