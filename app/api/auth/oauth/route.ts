import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const QuerySchema = z.object({
  provider: z.literal("github"),
  redirectTo: z.string().url().optional(),
});

/** Start an OAuth login without exposing provider credentials to the client. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = {
    provider: req.nextUrl.searchParams.get("provider"),
    redirectTo: req.nextUrl.searchParams.get("redirectTo") ?? undefined,
  };
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported OAuth provider" }, { status: 400 });
  }

  const redirectTo = parsed.data.redirectTo ?? `${req.nextUrl.origin}/api/auth/oauth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: { redirectTo },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message ?? "OAuth initialization failed" }, { status: 502 });
  }

  return NextResponse.redirect(data.url);
}
