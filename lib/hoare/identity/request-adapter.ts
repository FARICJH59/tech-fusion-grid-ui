import type { HoareIdentityAdapter, HoarePrincipal } from "./types";

/**
 * Adapter for deployments where an upstream trusted gateway has already
 * authenticated the request and injected identity headers.
 *
 * The gateway must be the component allowed to set these headers; callers
 * must not be able to reach the application directly while relying on them.
 */
export class TrustedGatewayIdentityAdapter implements HoareIdentityAdapter {
  async authenticate(request: Request): Promise<HoarePrincipal> {
    const userId = request.headers.get("x-hoare-user-id");
    const tenantId = request.headers.get("x-hoare-tenant-id");
    const roles = parseCsvHeader(request.headers.get("x-hoare-roles"));

    if (!userId || !tenantId) {
      throw new Error("Unauthenticated HOARE request: trusted user and tenant identity are required");
    }

    return {
      userId,
      tenantId,
      roles,
      claims: {
        source: "trusted-gateway",
      },
    };
  }
}

function parseCsvHeader(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
