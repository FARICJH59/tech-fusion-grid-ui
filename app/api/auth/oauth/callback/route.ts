import { NextResponse, type NextRequest } from "next/server";
import { createTokens, type Role, type TokenPayload } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * OAuth callback boundary. Supabase owns provider verification; HOARE owns
 * its canonical application token and tenant claim after verification.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing OAuth code" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.json({ error: "OAuth authentication failed" }, { status: 401 });
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

  return NextResponse.json(createTokens(payload), { status: 200 });
}
