import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  formatBookingTimeLabel,
  notifyBookingConfirmed,
  upsertCustomerByPhone,
} from "@/lib/booking-notify";
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
    const session = event.data.object as {
      metadata?: { bookingId?: string; resourceName?: string };
      payment_intent?: string | null;
    };
    const bookingId = session?.metadata?.bookingId;

    if (bookingId) {
      const { data: booking } = await supabase
        .from("bookings")
        .select(
          "id, user_name, user_email, user_phone, start_ts, end_ts, total_amount_cents, resource_id, resources(name)"
        )
        .eq("id", bookingId)
        .single();

      await supabase
        .from("bookings")
        .update({
          status: "CONFIRMED",
          stripe_payment_intent_id: session.payment_intent ?? null,
        })
        .eq("id", bookingId);

      if (booking?.user_email) {
        const resourceName =
          (booking as { resources?: { name?: string } | null }).resources?.name ||
          session.metadata?.resourceName ||
          "Spazio";

        const timeLabel = formatBookingTimeLabel(booking.start_ts, booking.end_ts);

        await notifyBookingConfirmed({
          customerEmail: booking.user_email,
          customerName: booking.user_name || "Cliente",
          fieldName: resourceName,
          timeLabel,
          bookingId: booking.id,
          totalCents: booking.total_amount_cents,
          userPhone: booking.user_phone,
        });

        if (booking.user_phone?.trim()) {
          try {
            await upsertCustomerByPhone(
              booking.user_name || "Cliente",
              booking.user_phone,
              booking.start_ts,
              supabase
            );
          } catch (e: any) {
            console.error("Errore rubrica clienti post-pagamento (non bloccante):", e.message);
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
