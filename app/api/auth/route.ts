/**
 * POST /api/auth/login — exchange credentials for JWT tokens
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createTokens, type TokenPayload, type Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = LoginSchema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password } = result.data;

  // Delegate credential verification to Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
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
  return NextResponse.json(tokens, { status: 200 });
}
