import {
  extractBearerToken,
  verifyToken,
  type Role,
  type TokenPayload,
} from "@/lib/auth";
import { EnterpriseSecurity } from "@/lib/enterprise/security";

export type ControlPlaneAction = "read" | "write" | "admin";

const ACTION_ROLE: Record<ControlPlaneAction, Role> = {
  read: "viewer",
  write: "operator",
  admin: "admin",
};

const security = new EnterpriseSecurity();

export type AuthorizedPrincipal = TokenPayload & {
  action: ControlPlaneAction;
};

export function authenticateControlPlane(
  authorization: string | null,
  action: ControlPlaneAction,
  resourceTenantId: string,
): AuthorizedPrincipal {
  const token = extractBearerToken(authorization);
  if (!token) throw new Error("Authentication required");

  const principal = verifyToken(token);
  const requiredRole = ACTION_ROLE[action];

  if (
    !security.isAuthorized({
      role: principal.role,
      tenantId: principal.tenantId,
      resourceTenantId,
      requiredRole,
      attributes: { scope: action },
    })
  ) {
    throw new Error("Forbidden: control-plane authorization denied");
  }

  return { ...principal, action };
}

export function resolveResourceTenant(
  principalTenantId: string,
  requestedTenantId: string | null,
): string {
  if (!requestedTenantId) return principalTenantId;
  if (requestedTenantId !== principalTenantId) {
    throw new Error("Forbidden: cross-tenant access denied");
  }
  return requestedTenantId;
}
