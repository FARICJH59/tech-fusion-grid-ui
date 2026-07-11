import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createTokens, type Role } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ensureTenantProvisioning } from "@/lib/enterprise/provisioning";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120).optional(),
  organizationName: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password, displayName, organizationName } = parsed.data;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        organization_name: organizationName,
        role: "viewer",
      },
    },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Signup failed" }, { status: 400 });
  }

  let tenantId = (data.user.user_metadata?.tenant_id as string | undefined) ?? data.user.id;

  try {
    const provisioning = await ensureTenantProvisioning({
      userId: data.user.id,
      email,
      displayName,
      organizationName,
      role: "viewer",
    });
    tenantId = provisioning.tenantId;
  } catch (provisionError) {
    return NextResponse.json(
      {
        error: "User created but provisioning failed",
        details: provisionError instanceof Error ? provisionError.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  if (!data.session) {
    return NextResponse.json(
      {
        message: "Signup successful. Verify your email to activate your workspace.",
        userId: data.user.id,
      },
      { status: 202 },
    );
  }

  const role: Role = (data.user.user_metadata?.role as Role | undefined) ?? "viewer";
  const tokens = createTokens({
    sub: data.user.id,
    email: data.user.email,
    role,
    tenantId,
  });

  return NextResponse.json(tokens, { status: 201 });
}
