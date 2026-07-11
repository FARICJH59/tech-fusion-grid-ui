import { NextResponse, type NextRequest } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  resolveEntitlements,
  type SubscriptionTier,
} from "@/lib/enterprise/entitlements";

type SubscriptionRow = {
  plan_tier: SubscriptionTier;
  status: string;
};

type CreditRow = {
  amount: number;
  type: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  if (!supabaseAdmin) {
    return NextResponse.json(resolveEntitlements("free", 0, user.role));
  }

  let tier: SubscriptionTier = "free";
  let credits = 0;

  const { data: subscriptions } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_tier, status")
    .eq("tenant_id", user.tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<SubscriptionRow[]>();

  if (subscriptions && subscriptions.length > 0) {
    tier = subscriptions[0].plan_tier;
  }

  const { data: creditEvents } = await supabaseAdmin
    .from("credit_ledger")
    .select("amount, type")
    .eq("tenant_id", user.tenantId)
    .returns<CreditRow[]>();

  if (creditEvents) {
    credits = creditEvents.reduce((total, event) => {
      if (event.type === "purchase" || event.type === "grant") {
        return total + event.amount;
      }
      if (event.type === "consume") {
        return total - event.amount;
      }
      return total;
    }, 0);
  }

  return NextResponse.json(resolveEntitlements(tier, Math.max(credits, 0), user.role));
}
