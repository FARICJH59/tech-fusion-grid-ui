export interface IdentityRequest {
  tenantId: string;
  provider: "gcp" | "aws" | "azure" | "github";
  audience: string;
  subject: string;
  permissions: readonly string[];
  ttlSeconds?: number;
}

export interface ShortLivedCredential {
  provider: IdentityRequest["provider"];
  token: string;
  expiresAt: string;
  permissions: readonly string[];
}

export interface IdentityBroker {
  issue(request: IdentityRequest): Promise<ShortLivedCredential>;
}

/**
 * Contract only: credential issuance belongs to the control plane.
 * Long-lived provider keys must never be embedded in builder agents.
 */
export function assertShortLivedCredential(credential: ShortLivedCredential, now = Date.now()): void {
  if (!credential.token) throw new Error("IDENTITY_TOKEN_REQUIRED");
  if (Date.parse(credential.expiresAt) <= now) throw new Error("IDENTITY_CREDENTIAL_EXPIRED");
}
