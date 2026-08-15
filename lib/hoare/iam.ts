export const PERMISSIONS = {
  SYSTEM_MANAGE: "system.manage",
  SYSTEM_VIEW: "system.view",
  AGENT_CREATE: "agent.create",
  AGENT_EXECUTE: "agent.execute",
  WORKFLOW_CREATE: "workflow.create",
  WORKFLOW_EXECUTE: "workflow.execute",
  TENANT_CREATE: "tenant.create",
  TENANT_MANAGE: "tenant.manage",
  CLOUD_VIEW: "cloud.view",
  CLOUD_DEPLOY: "cloud.deploy",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ROLES: Record<string, readonly Permission[]> = {
  "platform-admin": Object.values(PERMISSIONS),
  "platform-operator": [
    PERMISSIONS.SYSTEM_VIEW,
    PERMISSIONS.AGENT_EXECUTE,
    PERMISSIONS.WORKFLOW_EXECUTE,
    PERMISSIONS.CLOUD_DEPLOY,
  ],
  "tenant-admin": [
    PERMISSIONS.TENANT_MANAGE,
    PERMISSIONS.AGENT_CREATE,
    PERMISSIONS.WORKFLOW_CREATE,
  ],
  "builder": [
    PERMISSIONS.AGENT_CREATE,
    PERMISSIONS.AGENT_EXECUTE,
    PERMISSIONS.WORKFLOW_CREATE,
    PERMISSIONS.WORKFLOW_EXECUTE,
  ],
  "viewer": [PERMISSIONS.SYSTEM_VIEW, PERMISSIONS.CLOUD_VIEW],
};

export interface HoarePrincipal {
  id: string;
  tenantId: string;
  roles: string[];
  permissions?: Permission[];
}

export function permissionsForRoles(roles: string[]): Permission[] {
  return [...new Set(roles.flatMap((role) => ROLES[role] || []))];
}

export function hasPermission(principal: HoarePrincipal, permission: Permission): boolean {
  const effective = principal.permissions?.length ? principal.permissions : permissionsForRoles(principal.roles);
  return effective.includes(permission);
}

export function authorizePrincipal(
  principal: HoarePrincipal,
  tenantId: string,
  permission: Permission,
): { allowed: boolean; reason: string } {
  if (!principal.id?.trim()) return { allowed: false, reason: "PRINCIPAL_REQUIRED" };
  if (!tenantId?.trim() || principal.tenantId !== tenantId) {
    return { allowed: false, reason: "TENANT_ISOLATION_FAILED" };
  }
  if (!hasPermission(principal, permission)) {
    return { allowed: false, reason: "PERMISSION_DENIED" };
  }
  return { allowed: true, reason: "PERMISSION_GRANTED" };
}
