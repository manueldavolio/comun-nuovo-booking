import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

type Body = {
  resourceId: string;
  startISO: string;
  endISO: string;
  minutes: number; // 60 o 90
  payMode: "FULL" | "DEPOSIT";
  userName: string;
  userPhone: string;
};

const DEPOSIT_CENTS = Number(process.env.BOOKING_DEPOSIT_CENTS || "500");

// Prezzi (centesimi per ora)
const PRICE_PER_HOUR_CENTS: Record<string, number> = {
  Palazzetto: 6000, // 60€/h
  Tendone: 5000, // 50€/h (se il tuo sintetico si chiama Tendone)
  Sintetico: 5000, // 50€/h (se un domani lo rinomini)
};

function calcTotalCents(resourceName: string, minutes: number) {
  const perHour = PRICE_PER_HOUR_CENTS[resourceName] ?? 5000;
  return Math.round(perHour * (minutes / 60));
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (
    !body?.resourceId ||
    !body?.startISO ||
    !body?.endISO ||
    !body?.userName ||
    !body?.userPhone ||
    !["FULL", "DEPOSIT"].includes(body.payMode) ||
    ![60, 90].includes(body.minutes)
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data: resRow, error: rErr } = await supabase
    .from("resources")
    .select("id,name,is_public,is_active")
    .eq("id", body.resourceId)
    .single();

  if (rErr || !resRow) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  if (!resRow.is_active) return NextResponse.json({ error: "Resource inactive" }, { status: 400 });

  const totalCents = calcTotalCents(resRow.name, body.minutes);
  const amountCents = body.payMode === "FULL" ? totalCents : DEPOSIT_CENTS;

  // 1) crea booking PENDING_PAYMENT
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .insert({
      resource_id: body.resourceId,
      user_name: body.userName,
      user_phone: body.userPhone,
      start_ts: body.startISO,
      end_ts: body.endISO,
      status: "PENDING_PAYMENT",
      pay_mode: body.payMode,
      total_amount_cents: totalCents,
      deposit_amount_cents: DEPOSIT_CENTS,
      currency: "eur",
    })
    .select("id")
    .single();

  if (bErr) {
    return NextResponse.json(
      { error: "Slot non disponibile (già prenotato). Riprova." },
      { status: 409 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // 2) crea checkout stripe
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name:
              body.payMode === "FULL"
                ? `Prenotazione ${resRow.name}`
                : `Caparra 5€ - ${resRow.name}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/prenota?success=1`,
    cancel_url: `${baseUrl}/prenota?canceled=1`,
    metadata: {
      bookingId: booking.id,
      payMode: body.payMode,
      resourceName: resRow.name,
    },
  });

  await supabase.from("bookings").update({ stripe_session_id: session.id }).eq("id", booking.id);

  return NextResponse.json({ checkoutUrl: session.url });
}