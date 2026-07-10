/**
 * POST /api/auth/login — exchange credentials for JWT tokens
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createTokens, type TokenPayload, type Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/telemetry/otel";
import { withRateLimit, withErrorHandler, withValidation, toNextRoute } from "@/lib/middleware/api";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const POST = toNextRoute(
  withErrorHandler(
    withRateLimit(
      withValidation(LoginSchema, async (_req, ctx) => {
        const { email, password } = ctx.body;

        // Delegate credential verification to Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data.user) {
          logger.warn("[api/auth] Failed login attempt", { email });
          return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const user = data.user;
        const role: Role = (user.user_metadata?.role as Role | undefined) ?? "viewer";
        const tenantId: string = (user.user_metadata?.tenant_id as string | undefined) ?? user.id;

        const payload: TokenPayload = {
          sub: user.id,
          email: user.email,
          role,
          tenantId,
        };

        const tokens = createTokens(payload);
        logger.info("[api/auth] Login successful", { sub: user.id, role, tenantId });
        return NextResponse.json(tokens, { status: 200 });
      }),
    ),
  ),
);
