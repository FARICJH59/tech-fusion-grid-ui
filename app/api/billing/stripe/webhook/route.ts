import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string;
      status?: string;
      metadata?: Record<string, string | undefined>;
      plan?: { id?: string };
      items?: { data?: Array<{ price?: { id?: string } }> };
      current_period_start?: number;
      current_period_end?: number;
    };
  };
};

function verifySignature(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, item) => {
    const [key, value] = item.split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject stale webhook signatures before performing the HMAC comparison.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const payload = await req.text();
  if (!verifySignature(payload, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ received: true, ignored: true }, { status: 202 });
  }

  if (event.type !== "customer.subscription.created" && event.type !== "customer.subscription.updated") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const object = event.data.object;
  const tenantId = object.metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Missing canonical HOARE tenant_id in Stripe subscription metadata" }, { status: 400 });
  }

  // Never use the Stripe customer ID as HOARE tenant_id. Stripe is an external billing identity.
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError) return NextResponse.json({ error: tenantError.message }, { status: 500 });
  if (!tenant) return NextResponse.json({ error: "Unknown HOARE tenant_id" }, { status: 400 });

  const planIdentifier = object.plan?.id ?? object.items?.data?.[0]?.price?.id ?? "plan-free";
  const normalizedPlan = planIdentifier.toLowerCase();
  const planTier = normalizedPlan.includes("enterprise")
    ? "enterprise"
    : normalizedPlan.includes("pro")
      ? "pro"
      : "free";

  const subscriptionId = object.id;
  if (!subscriptionId) {
    return NextResponse.json({ error: "Stripe subscription id missing" }, { status: 400 });
  }

  const write = await supabaseAdmin.from("subscriptions").upsert(
    {
      tenant_id: tenant.id,
      provider: "stripe",
      provider_customer_id: object.customer,
      provider_subscription_id: subscriptionId,
      plan_tier: planTier,
      status: object.status ?? "active",
      current_period_start: object.current_period_start
        ? new Date(object.current_period_start * 1000).toISOString()
        : null,
      current_period_end: object.current_period_end
        ? new Date(object.current_period_end * 1000).toISOString()
        : null,
    },
    { onConflict: "provider_subscription_id" },
  );

  if (write.error) return NextResponse.json({ error: write.error.message }, { status: 500 });

  return NextResponse.json({ received: true, tenant_id: tenant.id }, { status: 200 });
}
