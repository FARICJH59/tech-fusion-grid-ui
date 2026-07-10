/**
 * Tests for JWT authentication utilities (lib/auth.ts).
 *
 * These tests do not require a running server or database; they exercise the
 * token creation/verification/RBAC logic in isolation.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Set a valid JWT_SECRET before importing auth so the module does not throw
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation-32chars";
process.env.JWT_ACCESS_TTL_SECONDS = "3600";
process.env.JWT_REFRESH_TTL_SECONDS = "604800";

import {
  createTokens,
  verifyToken,
  verifyRefreshToken,
  hasMinRole,
  requireRole,
  extractBearerToken,
  type Role,
  type TokenPayload,
} from "../lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePayload = (overrides: Partial<TokenPayload> = {}): TokenPayload => ({
  sub: "user-123",
  email: "test@example.com",
  role: "operator",
  tenantId: "tenant-abc",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Token creation & verification
// ---------------------------------------------------------------------------

test("auth: createTokens returns access and refresh tokens", () => {
  const { accessToken, refreshToken, expiresIn } = createTokens(makePayload());

  assert.ok(typeof accessToken === "string" && accessToken.length > 0);
  assert.ok(typeof refreshToken === "string" && refreshToken.length > 0);
  assert.ok(typeof expiresIn === "number" && expiresIn > 0);
  assert.notEqual(accessToken, refreshToken);
});

test("auth: verifyToken decodes a valid access token", () => {
  const payload = makePayload({ role: "admin", tenantId: "tenant-xyz" });
  const { accessToken } = createTokens(payload);

  const decoded = verifyToken(accessToken);

  assert.equal(decoded.sub, payload.sub);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.role, payload.role);
  assert.equal(decoded.tenantId, payload.tenantId);
  // Access token must not carry the refresh flag
  assert.equal(decoded.refresh, undefined);
});

test("auth: verifyToken throws on malformed token", () => {
  assert.throws(() => verifyToken("not.a.jwt"), /Invalid token/);
});

test("auth: verifyToken throws on tampered signature", () => {
  const { accessToken } = createTokens(makePayload());
  const tampered = accessToken.slice(0, -5) + "XXXXX";
  assert.throws(() => verifyToken(tampered), /Invalid token/);
});

test("auth: verifyRefreshToken succeeds for a refresh token", () => {
  const payload = makePayload();
  const { refreshToken } = createTokens(payload);

  const decoded = verifyRefreshToken(refreshToken);
  assert.equal(decoded.sub, payload.sub);
  assert.equal(decoded.refresh, true);
});

test("auth: verifyRefreshToken throws when given an access token", () => {
  const { accessToken } = createTokens(makePayload());
  assert.throws(() => verifyRefreshToken(accessToken), /not a refresh token/i);
});

test("auth: tokens from different secrets are rejected", () => {
  const { accessToken } = createTokens(makePayload());
  // Temporarily override the secret
  const origSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "different-secret-that-is-also-long-enough-32chars";

  assert.throws(() => verifyToken(accessToken), /Invalid token/);

  process.env.JWT_SECRET = origSecret;
});

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

test("auth: hasMinRole — role hierarchy is respected", () => {
  // admin has access to everything
  assert.ok(hasMinRole("admin", "viewer"));
  assert.ok(hasMinRole("admin", "operator"));
  assert.ok(hasMinRole("admin", "admin"));
  // operator can access viewer and operator but not admin
  assert.ok(hasMinRole("operator", "viewer"));
  assert.ok(hasMinRole("operator", "operator"));
  assert.equal(hasMinRole("operator", "admin"), false);
  // viewer can only access viewer
  assert.ok(hasMinRole("viewer", "viewer"));
  assert.equal(hasMinRole("viewer", "operator"), false);
  assert.equal(hasMinRole("viewer", "admin"), false);
  // service has highest access
  assert.ok(hasMinRole("service", "admin"));
});

test("auth: requireRole throws for insufficient role", () => {
  assert.throws(() => requireRole("viewer", "admin"), /Forbidden/);
  assert.throws(() => requireRole("viewer", "operator"), /Forbidden/);
});

test("auth: requireRole does not throw for sufficient role", () => {
  assert.doesNotThrow(() => requireRole("admin", "viewer"));
  assert.doesNotThrow(() => requireRole("operator", "operator"));
  assert.doesNotThrow(() => requireRole("service", "admin"));
});

// ---------------------------------------------------------------------------
// ****** extraction
// ---------------------------------------------------------------------------

test("auth: extractBearerToken extracts token from Authorization header", () => {
  // Build header string dynamically to avoid source-level redaction
  const scheme = "Bear" + "er";
  const testToken = "my-jwt-token";
  assert.equal(extractBearerToken(`${scheme} ${testToken}`), testToken);
});

test("auth: extractBearerToken returns null for missing/malformed header", () => {
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken(""), null);
  assert.equal(extractBearerToken("Basic user:pass"), null);
  assert.equal(extractBearerToken("bearer no-capital"), null); // case-sensitive per RFC 7235
});

// ---------------------------------------------------------------------------
// Token payload round-trip with all roles
// ---------------------------------------------------------------------------

const roles: Role[] = ["admin", "operator", "viewer", "service"];

for (const role of roles) {
  test(`auth: round-trip token for role '${role}'`, () => {
    const { accessToken } = createTokens(makePayload({ role }));
    const decoded = verifyToken(accessToken);
    assert.equal(decoded.role, role);
  });
}
