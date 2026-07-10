/**
 * API integration tests with authenticated tenant flows.
 *
 * Tests the full middleware chain (auth → rate-limit → handler) using real
 * JWT tokens and in-process mocks for Redis / Supabase.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation-32chars";
delete process.env.REDIS_URL; // use in-process rate limiter
delete process.env.SUPABASE_URL;

import { NextRequest, NextResponse } from "next/server";
import { createTokens, type TokenPayload, type Role } from "../lib/auth";
import {
  withAuth,
  withErrorHandler,
  toNextRoute,
  withCorrelationId,
  type AuthenticatedContext,
  type CorrelatedContext,
} from "../lib/middleware/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToken(overrides: Partial<TokenPayload> = {}): string {
  const payload: TokenPayload = {
    sub: "test-user-1",
    email: "user@tenant.example",
    role: "operator",
    tenantId: "tenant-integration-test",
    ...overrides,
  };
  return createTokens(payload).accessToken;
}

function req(path: string, opts: { token?: string; method?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.token) headers["authorization"] = ["Bearer", opts.token].join(" ");
  return new NextRequest(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers,
  });
}

async function json(res: Response): Promise<unknown> {
  return JSON.parse(await res.text()) as unknown;
}

// ---------------------------------------------------------------------------
// Auth flow
// ---------------------------------------------------------------------------

test("api-integration: valid token grants access to viewer-gated route", async () => {
  const handler = toNextRoute(
    withErrorHandler(
      withAuth(async () => NextResponse.json({ data: "ok" }), { role: "viewer" }),
    ),
  );
  const token = makeToken({ role: "viewer" });
  const res = await handler(req("/api/data", { token }));
  assert.equal(res.status, 200);
  assert.deepEqual(await json(res), { data: "ok" });
});

test("api-integration: admin token accesses operator-gated route", async () => {
  const handler = toNextRoute(
    withErrorHandler(withAuth(async () => NextResponse.json({ ok: true }), { role: "operator" })),
  );
  const token = makeToken({ role: "admin" });
  const res = await handler(req("/api/op", { token }));
  assert.equal(res.status, 200);
});

test("api-integration: viewer token rejected from admin-gated route", async () => {
  const handler = toNextRoute(
    withErrorHandler(withAuth(async () => NextResponse.json({ ok: true }), { role: "admin" })),
  );
  const token = makeToken({ role: "viewer" });
  const res = await handler(req("/api/admin", { token }));
  assert.equal(res.status, 403);
  const body = await json(res);
  assert.equal((body as { error: string }).error, "Forbidden");
});

test("api-integration: missing token returns 401", async () => {
  const handler = toNextRoute(
    withErrorHandler(withAuth(async () => NextResponse.json({ ok: true }))),
  );
  const res = await handler(req("/api/secure"));
  assert.equal(res.status, 401);
  const body = await json(res);
  assert.equal((body as { error: string }).error, "Unauthorized");
});

test("api-integration: tenantId is scoped per token", async () => {
  let capturedTenantId = "";
  const handler = toNextRoute(
    withErrorHandler(
      withAuth(async (_r, ctx: AuthenticatedContext) => {
        capturedTenantId = ctx.user.tenantId;
        return NextResponse.json({ tenantId: ctx.user.tenantId });
      }),
    ),
  );
  const token = makeToken({ tenantId: "org-xyz-456" });
  const res = await handler(req("/api/tenant", { token }));
  assert.equal(res.status, 200);
  assert.equal(capturedTenantId, "org-xyz-456");
});

// ---------------------------------------------------------------------------
// Correlation ID flow
// ---------------------------------------------------------------------------

test("api-integration: withCorrelationId propagates existing ID to response", async () => {
  const handler = toNextRoute(
    withCorrelationId(
      withErrorHandler(async () => NextResponse.json({ ok: true })),
    ),
  );
  const request = new NextRequest("http://localhost/api/corr", {
    headers: { "x-correlation-id": "my-trace-id-123" },
  });
  const res = await handler(request);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-correlation-id"), "my-trace-id-123");
});

test("api-integration: withCorrelationId generates ID when header absent", async () => {
  const handler = toNextRoute(
    withCorrelationId(
      withErrorHandler(async () => NextResponse.json({ ok: true })),
    ),
  );
  const res = await handler(req("/api/corr"));
  assert.equal(res.status, 200);
  const corrId = res.headers.get("x-correlation-id");
  assert.ok(corrId && corrId.length > 0, "Expected a correlation ID header");
});

test("api-integration: correlation ID is injected into ctx", async () => {
  let capturedId = "";
  const handler = toNextRoute(
    withCorrelationId(
      withErrorHandler(async (_r, ctx: CorrelatedContext) => {
        capturedId = ctx.correlationId;
        return NextResponse.json({ correlationId: ctx.correlationId });
      }),
    ),
  );
  const res = await handler(req("/api/corr"));
  assert.equal(res.status, 200);
  assert.ok(capturedId.length > 0, "Expected correlationId in ctx");
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test("api-integration: withErrorHandler catches thrown errors and returns 500", async () => {
  const handler = toNextRoute(
    withErrorHandler(
      async () => { throw new Error("database exploded"); },
    ),
  );
  const res = await handler(req("/api/boom"));
  assert.equal(res.status, 500);
  const body = await json(res);
  assert.equal((body as { error: string }).error, "Internal Server Error");
});

test("api-integration: withErrorHandler returns original response on success", async () => {
  const handler = toNextRoute(
    withErrorHandler(
      async () => NextResponse.json({ created: true }, { status: 201 }),
    ),
  );
  const res = await handler(req("/api/create"));
  assert.equal(res.status, 201);
  assert.deepEqual(await json(res), { created: true });
});
