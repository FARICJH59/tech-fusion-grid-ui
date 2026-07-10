/**
 * JWT authentication utilities: token creation, verification, refresh, and
 * RBAC role definitions.
 */

import jwt from "jsonwebtoken";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = "admin" | "operator" | "viewer" | "service";

export type TokenPayload = {
  sub: string; // user / service ID
  email?: string;
  role: Role;
  tenantId: string;
  /** Marks this as a refresh token — absent for access tokens */
  refresh?: true;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token TTL in seconds
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ACCESS_TTL = 900; // 15 minutes
const DEFAULT_REFRESH_TTL = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[auth] JWT_SECRET must be at least 32 characters in production",
      );
    }
    // Development / test fallback — never used in production
    return "dev-secret-please-set-JWT_SECRET-in-env-minimum-32-chars!!";
  }
  return secret;
}

const accessTtl = (): number =>
  parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? String(DEFAULT_ACCESS_TTL), 10) ||
  DEFAULT_ACCESS_TTL;

const refreshTtl = (): number =>
  parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? String(DEFAULT_REFRESH_TTL), 10) ||
  DEFAULT_REFRESH_TTL;

// ---------------------------------------------------------------------------
// Token creation
// ---------------------------------------------------------------------------

export function createTokens(payload: TokenPayload): AuthTokens {
  const secret = getSecret();
  const ttl = accessTtl();

  const accessToken = jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role, tenantId: payload.tenantId },
    secret,
    { expiresIn: ttl },
  );

  const refreshToken = jwt.sign(
    { sub: payload.sub, role: payload.role, tenantId: payload.tenantId, refresh: true },
    secret,
    { expiresIn: refreshTtl() },
  );

  return { accessToken, refreshToken, expiresIn: ttl };
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

const TokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(["admin", "operator", "viewer", "service"]),
  tenantId: z.string().min(1),
  refresh: z.literal(true).optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export function verifyToken(token: string): TokenPayload {
  const secret = getSecret();
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    throw new Error(
      `Invalid token: ${err instanceof jwt.TokenExpiredError ? "expired" : "malformed"}`,
    );
  }
  const result = TokenPayloadSchema.safeParse(decoded);
  if (!result.success) {
    throw new Error("Token payload is malformed");
  }
  return result.data;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const payload = verifyToken(token);
  if (!payload.refresh) {
    throw new Error("Token is not a refresh token");
  }
  return payload;
}

// ---------------------------------------------------------------------------
// RBAC helpers
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY: Record<Role, number> = {
  service: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

/**
 * Returns true if the actor's role meets or exceeds the required minimum.
 */
export function hasMinRole(actorRole: Role, required: Role): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[required];
}

/**
 * Throws if the actor does not have the required minimum role.
 */
export function requireRole(actorRole: Role, required: Role): void {
  if (!hasMinRole(actorRole, required)) {
    throw new Error(`Forbidden: requires role '${required}', got '${actorRole}'`);
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Extract the bearer token from an Authorization header.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
