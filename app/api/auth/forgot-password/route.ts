import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, redirectTo } = parsed.data;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to initiate password reset" }, { status: 400 });
  }

  return NextResponse.json(
    {
      message: "If an account exists for this email, a reset link has been sent.",
    },
    { status: 200 },
  );
}
