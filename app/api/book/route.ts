import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  resourceId: string;
  startISO: string;
  endISO: string;
  minutes: number; // 60 o 90
  userName: string;
  userPhone: string;
};

// Prezzi (centesimi per ora)
const PRICE_PER_HOUR_CENTS: Record<string, number> = {
  Palazzetto: 6000, // 60€/h
  Tendone: 5000, // 50€/h
  Sintetico: 5000, // 50€/h
};

function calcTotalCents(resourceName: string, minutes: number) {
  const perHour = PRICE_PER_HOUR_CENTS[resourceName] ?? 5000;
  return Math.round(perHour * (minutes / 60));
}

async function upsertCustomer(name: string, phone: string, bookingDateISO: string) {
  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id, bookings_count")
    .eq("phone", phone)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("customers").insert({
      name,
      phone,
      first_booking_at: bookingDateISO,
      last_booking_at: bookingDateISO,
      bookings_count: 1,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return;
  }

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      name,
      last_booking_at: bookingDateISO,
      bookings_count: (existing.bookings_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (
    !body?.resourceId ||
    !body?.startISO ||
    !body?.endISO ||
    !body?.userName ||
    !body?.userPhone ||
    ![60, 90].includes(Number(body.minutes))
  ) {
    return NextResponse.json({ error: "Dati mancanti/non validi" }, { status: 400 });
  }

  const { data: resRow, error: rErr } = await supabase
    .from("resources")
    .select("id,name,is_active")
    .eq("id", body.resourceId)
    .single();

  if (rErr || !resRow) {
    return NextResponse.json({ error: "Risorsa non trovata" }, { status: 404 });
  }

  if (!resRow.is_active) {
    return NextResponse.json({ error: "Risorsa non attiva" }, { status: 400 });
  }

  const totalCents = calcTotalCents(resRow.name, body.minutes);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      resource_id: body.resourceId,
      user_name: body.userName,
      user_phone: body.userPhone,
      start_ts: body.startISO,
      end_ts: body.endISO,
      status: "CONFIRMED",
      pay_mode: "BAR",
      total_amount_cents: totalCents,
      deposit_amount_cents: 500,
      currency: "eur",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Slot non disponibile (già prenotato)" }, { status: 409 });
  }

  try {
    await upsertCustomer(body.userName, body.userPhone, body.startISO);
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Prenotazione salvata ma errore aggiornamento rubrica clienti",
        detail: e.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, bookingId: data.id, totalCents, customerSaved: true });
}