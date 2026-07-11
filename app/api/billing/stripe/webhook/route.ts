import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      customer?: string;
      status?: string;
      metadata?: Record<string, string | undefined>;
      plan?: { id?: string };
      items?: {
        data?: Array<{ price?: { id?: string } }>;
      };
    };
  };
};

function verifySignature(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, item) => {
    const [k, v] = item.split("=");
    if (k && v) {
      acc[k] = v;
    }
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const payload = await req.text();
  const signatureHeader = req.headers.get("stripe-signature");

  if (!verifySignature(payload, signatureHeader)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  if (!supabaseAdmin) {
    return NextResponse.json({ received: true, ignored: true }, { status: 202 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const object = event.data.object;
    const tenantId = object.metadata?.tenant_id;

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenant metadata" }, { status: 400 });
    }

    const planIdentifier =
      object.plan?.id ?? object.items?.data?.[0]?.price?.id ?? "plan-free";
    const planTier = planIdentifier.toLowerCase().includes("enterprise")
      ? "enterprise"
      : planIdentifier.toLowerCase().includes("pro")
        ? "pro"
        : "free";

    const write = await supabaseAdmin.from("subscriptions").upsert(
      {
        tenant_id: tenantId,
        provider: "stripe",
        provider_customer_id: object.customer,
        provider_subscription_id: event.id,
        plan_tier: planTier,
        status: object.status ?? "active",
      },
      { onConflict: "provider_subscription_id" },
    );

    if (write.error) {
      return NextResponse.json({ error: write.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
