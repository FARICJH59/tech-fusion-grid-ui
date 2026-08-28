export interface HoarePrincipal {
  userId: string;
  tenantId: string;
  roles: string[];
  claims: Record<string, unknown>;
}

export interface HoareIdentityAdapter {
  authenticate(request: Request): Promise<HoarePrincipal>;
}
