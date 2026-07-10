/**
 * POST /api/auth/refresh — exchange a refresh token for a new access token
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createTokens, verifyRefreshToken, type TokenPayload } from "@/lib/auth";

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = RefreshSchema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 },
    );
  }

  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(result.data.refreshToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  const tokens = createTokens({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,
  });

  return NextResponse.json(tokens, { status: 200 });
}
