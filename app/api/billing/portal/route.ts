import { NextResponse, type NextRequest } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let user;
  try {
    user = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portalBase =
    process.env.STRIPE_BILLING_PORTAL_URL ?? "https://billing.stripe.com/p/session/example";
  const returnBase = process.env.APP_BASE_URL ?? new URL(req.url).origin;

  const portalUrl = `${portalBase}?prefilled_email=${encodeURIComponent(
    user.email ?? "",
  )}&return_url=${encodeURIComponent(`${returnBase}/platform`)}`;

  return NextResponse.json({ url: portalUrl }, { status: 200 });
}
