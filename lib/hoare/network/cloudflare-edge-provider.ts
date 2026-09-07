import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { SecretAccessRequest } from "@/lib/hoare/secrets/secret-provider";
import type { SecretCapabilityReference } from "@/lib/hoare/secrets/secret-capability";
import type { CloudflareDomainConfig } from "./cloudflare-domain";

export type CloudflareDnsRecord = Readonly<{
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}>;

export type CloudflareSecretCredentialRequest = Readonly<{
  capability: SecretCapabilityReference;
  access: SecretAccessRequest;
}>;

export type CloudflareEdgeRequest = Readonly<{
  tenantId: string;
  transactionId: string;
  attemptId: string;
  recordId: string;
  record: CloudflareDnsRecord;
  authority: GovernedExecutionAuthority;
  credential?: CloudflareSecretCredentialRequest;
}>;

export type CloudflareEdgeResult = Readonly<{
  accepted: true;
  executionId: string;
  hostname: string;
  zoneId: string;
}>;

type FetchLike = typeof fetch;

export type CloudflareEdgeProviderOptions = Readonly<{
  domain: CloudflareDomainConfig;
  /** Static token is retained only for local/test compatibility. */
  token?: string;
  /** Legacy dynamic credential seam. */
  getToken?: () => Promise<string | undefined>;
  /** Production credential seam: resolve a token from a governed secret capability. */
  getTokenForRequest?: (request: CloudflareSecretCredentialRequest) => Promise<string | undefined>;
  tenantZoneBinding: ReadonlyMap<string, string>;
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
}>;

/** Governed Cloudflare mutation boundary; this is not a generic Cloudflare client. */
export class CloudflareEdgeProvider {
  readonly target = "cloudflare" as const;

  private readonly domain: CloudflareDomainConfig;
  private readonly token?: string;
  private readonly getToken?: () => Promise<string | undefined>;
  private readonly getTokenForRequest?: (request: CloudflareSecretCredentialRequest) => Promise<string | undefined>;
  private readonly tenantZoneBinding: ReadonlyMap<string, string>;
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: CloudflareEdgeProviderOptions) {
    this.domain = options.domain;
    this.token = options.token;
    this.getToken = options.getToken;
    this.getTokenForRequest = options.getTokenForRequest;
    this.tenantZoneBinding = options.tenantZoneBinding;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.token && !this.getToken && !this.getTokenForRequest) {
      throw new Error("cloudflare_credential_provider_required");
    }
  }

  async updateDnsRecord(request: CloudflareEdgeRequest): Promise<CloudflareEdgeResult> {
    if (this.tenantZoneBinding.get(request.tenantId) !== this.domain.zoneId) {
      throw new Error("cloudflare_zone_tenant_binding_invalid");
    }
    if (request.record.name.toLowerCase().replace(/\.$/, "") !== this.domain.hostname) {
      throw new Error("cloudflare_hostname_mismatch");
    }

    assertTcxExecutionAuthority(request.authority);
    if (request.authority.tenantId !== request.tenantId) throw new Error("cloudflare_tenant_mismatch");
    if (request.authority.transactionId !== request.transactionId || request.authority.attemptId !== request.attemptId) {
      throw new Error("cloudflare_attempt_mismatch");
    }

    request.authority.assertValid();
    const token = await this.resolveTokenForRequest(request);
    if (!token) throw new Error("cloudflare_credential_missing");
    request.authority.assertValid();

    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/zones/${encodeURIComponent(this.domain.zoneId)}/dns_records/${encodeURIComponent(request.recordId)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(request.record),
      },
    );

    request.authority.assertValid();
    if (!response.ok) throw new Error(`cloudflare_mutation_failed:${response.status}`);

    return {
      accepted: true,
      executionId: `cloudflare:${this.domain.zoneId}:${request.recordId}:${request.attemptId}`,
      hostname: this.domain.hostname,
      zoneId: this.domain.zoneId,
    };
  }

  private async resolveTokenForRequest(request: CloudflareEdgeRequest): Promise<string | undefined> {
    if (this.getTokenForRequest) {
      if (!request.credential) throw new Error("cloudflare_capability_credential_required");
      return (await this.getTokenForRequest(request.credential))?.trim() || undefined;
    }
    if (this.getToken) return (await this.getToken())?.trim() || undefined;
    return this.token?.trim() || undefined;
  }
}
