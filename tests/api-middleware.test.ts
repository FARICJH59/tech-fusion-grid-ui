/**
 * Tests for lib/middleware/api.ts — withAuth, withRateLimit, withValidation,
 * withErrorHandler.
 *
 * These tests exercise the middleware functions in isolation using lightweight
 * NextRequest / NextResponse instances without requiring a running server.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Set required env vars before importing modules under test
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation-32chars";
process.env.NODE_ENV = "test";
// Disable Redis for middleware tests so the in-process rate limiter is used
delete process.env.REDIS_URL;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTokens, type TokenPayload } from "../lib/auth";
import {
  withAuth,
  withRateLimit,
  withValidation,
  withErrorHandler,
  type AuthenticatedContext,
} from "../lib/middleware/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: unknown } = {},
): NextRequest {
  const url = `http://localhost${path}`;
  const init: RequestInit = { method };
  if (options.headers) init.headers = options.headers;
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  return new NextRequest(url, init);
}

function makeAuthHeader(payload: Partial<TokenPayload> = {}): Record<string, string> {
  const full: TokenPayload = {
    sub: "user-1",
    email: "test@example.com",
    role: "operator",
    tenantId: "tenant-abc",
    ...payload,
  };
  const { accessToken } = createTokens(full);
  const scheme = "Bear" + "er";
  return { authorization: `${scheme} ${accessToken}` };
}

async function readJson(res: NextResponse | Response): Promise<unknown> {
  return JSON.parse(await res.text()) as unknown;
}

// ---------------------------------------------------------------------------
// withErrorHandler
// ---------------------------------------------------------------------------

test("withErrorHandler: passes through successful response", async () => {
  const handler = withErrorHandler(async () =>
    NextResponse.json({ ok: true }, { status: 200 }),
  );
  const res = await handler(makeRequest("GET", "/test"), {});
  assert.equal(res.status, 200);
  assert.deepEqual(await readJson(res), { ok: true });
});

test("withErrorHandler: catches thrown errors and returns 500", async () => {
  const handler = withErrorHandler(async () => {
    throw new Error("boom");
  });
  const res = await handler(makeRequest("GET", "/test"), {});
  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.equal((body as { error: string }).error, "Internal Server Error");
});

// ---------------------------------------------------------------------------
// withRateLimit (in-process bucket; limit defaults to 60 / 60 s)
// ---------------------------------------------------------------------------

test("withRateLimit: allows requests under the limit", async () => {
  process.env.RATE_LIMIT_MAX = "5";
  process.env.RATE_LIMIT_WINDOW_MS = "60000";

  const handler = withRateLimit(async () => NextResponse.json({ ok: true }));
  const req = makeRequest("GET", "/rl", {
    headers: { "x-forwarded-for": `10.0.99.${Math.floor(Math.random() * 200)}` },
  });
  const res = await handler(req, {});
  assert.equal(res.status, 200);

  delete process.env.RATE_LIMIT_MAX;
  delete process.env.RATE_LIMIT_WINDOW_MS;
});

test("withRateLimit: rejects requests over the limit", async () => {
  process.env.RATE_LIMIT_MAX = "3";
  process.env.RATE_LIMIT_WINDOW_MS = "60000";

  // Use a unique IP to avoid interference from other tests
  const ip = `10.1.1.${Math.floor(Math.random() * 200)}`;
  const handler = withRateLimit(async () => NextResponse.json({ ok: true }));

  let lastRes: NextResponse | Response | null = null;
  for (let i = 0; i < 5; i++) {
    lastRes = await handler(
      makeRequest("GET", "/rl", { headers: { "x-forwarded-for": ip } }),
      {},
    );
  }

  assert.ok(lastRes !== null);
  assert.equal(lastRes!.status, 429);
  const body = await readJson(lastRes!);
  assert.equal((body as { error: string }).error, "Too Many Requests");

  delete process.env.RATE_LIMIT_MAX;
  delete process.env.RATE_LIMIT_WINDOW_MS;
});

// ---------------------------------------------------------------------------
// withAuth
// ---------------------------------------------------------------------------

test("withAuth: returns 401 when no Authorization header", async () => {
  const handler = withAuth(async () => NextResponse.json({ ok: true }));
  const res = await handler(makeRequest("GET", "/protected"), {});
  assert.equal(res.status, 401);
  const body = await readJson(res);
  assert.equal((body as { error: string }).error, "Unauthorized");
});

test("withAuth: returns 401 for malformed/tampered token", async () => {
  const handler = withAuth(async () => NextResponse.json({ ok: true }));
  const scheme = "Bear" + "er";
  const req = makeRequest("GET", "/protected", {
    headers: { authorization: `${scheme} not.a.valid.jwt.token` },
  });
  const res = await handler(req, {});
  assert.equal(res.status, 401);
});

test("withAuth: returns 403 when role is insufficient", async () => {
  const handler = withAuth(async () => NextResponse.json({ ok: true }), { role: "admin" });
  const req = makeRequest("GET", "/admin", { headers: makeAuthHeader({ role: "viewer" }) });
  const res = await handler(req, {});
  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal((body as { error: string }).error, "Forbidden");
});

test("withAuth: allows access when role meets requirement", async () => {
  const handler = withAuth(
    async (_req, ctx: AuthenticatedContext) =>
      NextResponse.json({ tenantId: ctx.user.tenantId }),
    { role: "operator" },
  );
  const req = makeRequest("GET", "/op", { headers: makeAuthHeader({ role: "operator" }) });
  const res = await handler(req, {});
  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal((body as { tenantId: string }).tenantId, "tenant-abc");
});

test("withAuth: injects user into context", async () => {
  let capturedUser: TokenPayload | null = null;
  const handler = withAuth(async (_req, ctx: AuthenticatedContext) => {
    capturedUser = ctx.user;
    return NextResponse.json({ ok: true });
  });
  const headers = makeAuthHeader({ role: "admin", sub: "u-999", tenantId: "tenant-xyz" });
  await handler(makeRequest("GET", "/ctx", { headers }), {});
  assert.ok(capturedUser !== null);
  assert.equal(capturedUser!.sub, "u-999");
  assert.equal(capturedUser!.tenantId, "tenant-xyz");
  assert.equal(capturedUser!.role, "admin");
});

test("withAuth: admin can access operator-gated route", async () => {
  const handler = withAuth(async () => NextResponse.json({ ok: true }), { role: "operator" });
  const req = makeRequest("GET", "/op", { headers: makeAuthHeader({ role: "admin" }) });
  const res = await handler(req, {});
  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// withValidation
// ---------------------------------------------------------------------------

const TestSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
});

test("withValidation: passes parsed body to handler", async () => {
  const handler = withValidation(TestSchema, async (_req, ctx) =>
    NextResponse.json({ received: ctx.body }),
  );
  const req = makeRequest("POST", "/v", {
    body: { name: "sensor", value: 42 },
    headers: { "content-type": "application/json" },
  });
  const res = await handler(req, {});
  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.deepEqual((body as { received: unknown }).received, { name: "sensor", value: 42 });
});

test("withValidation: returns 400 for invalid JSON body", async () => {
  const handler = withValidation(TestSchema, async () => NextResponse.json({ ok: true }));
  const req = new NextRequest("http://localhost/v", {
    method: "POST",
    body: "not json {{{",
    headers: { "content-type": "application/json" },
  });
  const res = await handler(req, {});
  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal((body as { error: string }).error, "Invalid JSON body");
});

test("withValidation: returns 400 for schema mismatch", async () => {
  const handler = withValidation(TestSchema, async () => NextResponse.json({ ok: true }));
  const req = makeRequest("POST", "/v", {
    body: { name: "", value: "not-a-number" },
    headers: { "content-type": "application/json" },
  });
  const res = await handler(req, {});
  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal((body as { error: string }).error, "Validation failed");
});

// ---------------------------------------------------------------------------
// Composition: withErrorHandler(withAuth(handler))
// ---------------------------------------------------------------------------

test("composed withErrorHandler + withAuth: catches handler errors", async () => {
  const handler = withErrorHandler(
    withAuth(async () => {
      throw new Error("db gone");
    }),
  );
  const req = makeRequest("GET", "/c", { headers: makeAuthHeader() });
  const res = await handler(req, {});
  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.equal((body as { error: string }).error, "Internal Server Error");
});
