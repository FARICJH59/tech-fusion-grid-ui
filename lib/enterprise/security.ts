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

export class EnterpriseSecurity {
  isAuthorized(input: SecurityPolicyInput): boolean {
    const requiredRole = input.requiredRole ?? "viewer";
    const rbacAllowed = roleRank[input.role] >= roleRank[requiredRole];
    const tenantIsolated = input.tenantId === input.resourceTenantId;

    if (!rbacAllowed || !tenantIsolated) return false;

    if (!input.attributes) return true;
    const abacScope = input.attributes.scope;
    if (abacScope && !["read", "write", "admin"].includes(abacScope)) {
      return false;
    }
    return true;
  }
}
