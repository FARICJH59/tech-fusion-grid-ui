import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createTokens, type Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ensureTenantProvisioning } from "@/lib/enterprise/provisioning";

const VerifySchema = z.object({
  tokenHash: z.string().min(1),
  type: z.enum(["signup", "magiclink", "recovery", "email_change", "invite"]).default("signup"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = VerifySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tokenHash, type } = parsed.data;
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.user || !data.session) {
    return NextResponse.json({ error: error?.message ?? "Verification failed" }, { status: 400 });
  }

  let tenantId = (data.user.user_metadata?.tenant_id as string | undefined) ?? data.user.id;
  const role: Role = (data.user.user_metadata?.role as Role | undefined) ?? "viewer";

  try {
    const provisioning = await ensureTenantProvisioning({
      userId: data.user.id,
      email: data.user.email ?? "",
      displayName: data.user.user_metadata?.display_name as string | undefined,
      organizationName: data.user.user_metadata?.organization_name as string | undefined,
      role,
    });
    tenantId = provisioning.tenantId;
  } catch (provisionError) {
    return NextResponse.json(
      {
        error: "Verification succeeded but provisioning failed",
        details: provisionError instanceof Error ? provisionError.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  const tokens = createTokens({
    sub: data.user.id,
    email: data.user.email,
    role,
    tenantId,
  });

  return NextResponse.json(tokens, { status: 200 });
}
