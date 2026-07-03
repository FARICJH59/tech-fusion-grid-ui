import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    })
  : null;

export async function POST(req: NextRequest) {
  if (!stripe || !stripeWebhookSecret) {
    console.error("Stripe webhook env vars are not configured");
    return NextResponse.json(
      { error: "Webhook service unavailable" },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email;

    if (!email) {
      console.warn("Skipping entitlement update: no email in checkout session");
      return NextResponse.json({ received: true });
    }

    const { error } = await supabaseAdmin
      .from("entitlements")
      .update({
        subscription_active: true,
        subscription_level: "pro",
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (error) {
      console.error("Entitlement update error:", error);
      return NextResponse.json(
        { error: "Failed to update entitlement" },
        { status: 500 }
      );
    }

    console.log("Entitlements activated for:", email);
  }

  return NextResponse.json({ received: true });
}
