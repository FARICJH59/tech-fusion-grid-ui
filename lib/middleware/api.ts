/**
 * Composable Next.js App Router middleware utilities.
 *
 * Usage:
 *   export const GET = withAuth(async (req, ctx) => { … }, { role: "operator" });
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, extractBearerToken, hasMinRole, type Role, type TokenPayload } from "@/lib/auth";
import { logger } from "@/lib/telemetry/otel";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthenticatedContext = {
  user: TokenPayload;
};

export type RouteHandler<C = Record<string, unknown>> = (
  req: NextRequest,
  ctx: C,
) => Promise<NextResponse | Response>;

export type AuthOptions = {
  /** Minimum role required. Defaults to "viewer". */
  role?: Role;
};

// ---------------------------------------------------------------------------
// Rate limiter — Redis-backed with in-process fallback
// ---------------------------------------------------------------------------

type Bucket = { tokens: number; last: number };
const buckets = new Map<string, Bucket>();

const RATE_LIMIT_MAX = () =>
  parseInt(process.env.RATE_LIMIT_MAX ?? "60", 10) || 60;
const RATE_LIMIT_WINDOW_MS = () =>
  parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10) || 60_000;

/** In-process token-bucket fallback (single-node only). */
function checkRateLimitInProcess(ip: string): boolean {
  const now = Date.now();
  const max = RATE_LIMIT_MAX();
  const windowMs = RATE_LIMIT_WINDOW_MS();

  const bucket = buckets.get(ip) ?? { tokens: max, last: now };
  const elapsed = now - bucket.last;
  const refill = Math.floor((elapsed / windowMs) * max);
  bucket.tokens = Math.min(max, bucket.tokens + refill);
  bucket.last = now;

  if (bucket.tokens <= 0) {
    buckets.set(ip, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(ip, bucket);
  return true;
}

/**
 * Redis-backed sliding-window rate limiter using INCR + PEXPIRE.
 * Falls back to the in-process bucket on Redis errors so the API stays up.
 */
async function checkRateLimit(ip: string): Promise<boolean> {
  if (!process.env.REDIS_URL) {
    return checkRateLimitInProcess(ip);
  }

  try {
    const { getRedis } = await import("@/lib/redis");
    const client = getRedis();
    const key = `rate:${ip}`;
    const max = RATE_LIMIT_MAX();
    const windowMs = RATE_LIMIT_WINDOW_MS();

    const pipeline = client.multi();
    pipeline.incr(key);
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();

    const count = results?.[0]?.[1] as number | null;
    if (count == null) return checkRateLimitInProcess(ip);
    return count <= max;
  } catch (err) {
    logger.warn("[middleware] Redis rate-limit check failed, using in-process fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    return checkRateLimitInProcess(ip);
  }
}

// ---------------------------------------------------------------------------
// withRateLimit
// ---------------------------------------------------------------------------

export function withRateLimit<C = Record<string, unknown>>(
  handler: RouteHandler<C>,
): RouteHandler<C> {
  return async (req, ctx) => {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      logger.warn("[middleware] Rate limit exceeded", { ip });
      return NextResponse.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        },
      );
    }
    return handler(req, ctx);
  };
}

// ---------------------------------------------------------------------------
// withAuth
// ---------------------------------------------------------------------------

export function withAuth<C = Record<string, unknown>>(
  handler: RouteHandler<C & AuthenticatedContext>,
  options: AuthOptions = {},
): RouteHandler<C> {
  const requiredRole: Role = options.role ?? "viewer";

  return withRateLimit(async (req, ctx) => {
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user: TokenPayload;
    try {
      user = verifyToken(token);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, requiredRole)) {
      logger.warn("[middleware] Forbidden: insufficient role", {
        role: user.role,
        required: requiredRole,
        sub: user.sub,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(req, { ...ctx, user } as C & AuthenticatedContext);
  });
}

// ---------------------------------------------------------------------------
// withValidation
// ---------------------------------------------------------------------------

export function withValidation<TBody, C = Record<string, unknown>>(
  schema: z.ZodSchema<TBody>,
  handler: RouteHandler<C & { body: TBody }>,
): RouteHandler<C> {
  return async (req, ctx) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 },
      );
    }
    return handler(req, { ...ctx, body: result.data } as C & { body: TBody });
  };
}

// ---------------------------------------------------------------------------
// Error wrapper
// ---------------------------------------------------------------------------

export function withErrorHandler<C = Record<string, unknown>>(
  handler: RouteHandler<C>,
): RouteHandler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      logger.error("[api] Unhandled error", {
        error: err instanceof Error ? err.message : String(err),
        path: req.nextUrl?.pathname,
      });
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  };
}

// ---------------------------------------------------------------------------
// toNextRoute — adapts RouteHandler to the Next.js App Router export signature
//
// Next.js 15 validates that exported route handlers do not accept a second
// parameter typed as Record<string, unknown>. toNextRoute produces a
// single-argument function satisfying that constraint while keeping the full
// middleware chain intact.
// ---------------------------------------------------------------------------

export function toNextRoute<C = Record<string, unknown>>(
  handler: RouteHandler<C>,
): (req: NextRequest) => Promise<NextResponse | Response> {
  return (req: NextRequest) => handler(req, {} as C);
}
