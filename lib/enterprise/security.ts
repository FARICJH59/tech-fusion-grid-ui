import type { Role } from "@/lib/auth";

export const SECURITY_CAPABILITIES = [
  "RBAC",
  "ABAC",
  "MFA hooks",
  "API Keys",
  "OAuth",
  "JWT",
  "Audit Logs",
  "Tenant Isolation",
  "Encryption",
  "Secret Rotation",
] as const;

export type SecurityPolicyInput = {
  role: Role;
  tenantId: string;
  resourceTenantId: string;
  attributes?: Record<string, string>;
  requiredRole?: Role;
};

const roleRank: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
  service: 4,
};
const DEFAULT_REQUIRED_ROLE: Role = "viewer";
const ALLOWED_ABAC_SCOPES = new Set(["read", "write", "admin"]);

export class EnterpriseSecurity {
  isAuthorized(input: SecurityPolicyInput): boolean {
    const requiredRole = input.requiredRole ?? DEFAULT_REQUIRED_ROLE;
    const rbacAllowed = roleRank[input.role] >= roleRank[requiredRole];
    const tenantIsolated = input.tenantId === input.resourceTenantId;

    if (!rbacAllowed || !tenantIsolated) return false;

    if (!input.attributes) return true;
    const abacScope = input.attributes.scope;
    if (abacScope && !ALLOWED_ABAC_SCOPES.has(abacScope)) {
      return false;
    }
    return true;
  }
}
