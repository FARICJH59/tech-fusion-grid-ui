export type AuthProvider = "email" | "github";

export type CanonicalIdentity = {
  accountId: string;
  tenantId: string;
  subjectId: string;
  provider: AuthProvider;
  email?: string;
  billingCustomerId?: string;
};

export type IdentityLink = {
  accountId: string;
  provider: AuthProvider;
  subjectId: string;
};

/**
 * Pure identity mapping used by the builder. Persistence/linking belongs to
 * the application identity adapter; this module never creates duplicate
 * tenants from provider-specific IDs.
 */
export function resolveCanonicalIdentity(
  link: IdentityLink,
  existing?: Pick<CanonicalIdentity, "accountId" | "tenantId" | "billingCustomerId">,
): CanonicalIdentity {
  return {
    accountId: existing?.accountId ?? link.accountId,
    tenantId: existing?.tenantId ?? link.accountId,
    subjectId: link.subjectId,
    provider: link.provider,
    billingCustomerId: existing?.billingCustomerId,
  };
}
