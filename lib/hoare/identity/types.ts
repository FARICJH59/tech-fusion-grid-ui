export interface HoarePrincipal {
  userId: string;
  tenantId: string;
  roles: string[];
  claims?: Record<string, unknown>;
}

export interface HoareIdentityAdapter {
  authenticate(request: Request): Promise<HoarePrincipal>;
}

export function assertPrincipal(principal: HoarePrincipal): HoarePrincipal {
  if (!principal.userId) throw new Error("Authenticated user identity is required");
  if (!principal.tenantId) throw new Error("Authenticated tenant identity is required");
  return principal;
}
