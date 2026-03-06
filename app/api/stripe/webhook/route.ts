import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const sig = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing stripe signature or webhook secret" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const bookingId = session?.metadata?.bookingId as string | undefined;
    const paymentIntent = session?.payment_intent as string | undefined;

    if (bookingId) {
      await supabase
        .from("bookings")
        .update({ status: "CONFIRMED", stripe_payment_intent_id: paymentIntent ?? null })
        .eq("id", bookingId);
    }
  }

  return NextResponse.json({ received: true });
}