/**
 * POST /api/auth/refresh — exchange a refresh token for a new access token
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createTokens, verifyRefreshToken, type TokenPayload } from "@/lib/auth";
import { logger } from "@/lib/telemetry/otel";
import { withRateLimit, withErrorHandler, withValidation, toNextRoute } from "@/lib/middleware/api";

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const POST = toNextRoute(
  withErrorHandler(
    withRateLimit(
      withValidation(RefreshSchema, async (_req, ctx) => {
        let payload: TokenPayload;
        try {
          payload = verifyRefreshToken(ctx.body.refreshToken);
        } catch {
          return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
        }

        const tokens = createTokens({
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
          tenantId: payload.tenantId,
        });

        logger.info("[api/auth/refresh] Token refreshed", { sub: payload.sub });
        return NextResponse.json(tokens, { status: 200 });
      }),
    ),
  ),
);
