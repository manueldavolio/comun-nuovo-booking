import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/booking-email";
import {
  formatBookingTimeLabel,
  notifyBookingConfirmed,
  upsertCustomerByPhone,
} from "@/lib/booking-notify";
import { calcTotalCents } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";

type Body = {
  resourceId: string;
  startISO: string;
  endISO: string;
  minutes: number; // 60 o 90
  userName: string;
  userEmail: string;
  userPhone?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const userEmail = normalizeEmail(body?.userEmail ?? "");

  if (
    !body?.resourceId ||
    !body?.startISO ||
    !body?.endISO ||
    !body?.userName?.trim() ||
    !userEmail ||
    !isValidEmail(userEmail) ||
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

  const totalCents = calcTotalCents(resRow.name, body.minutes, body.startISO);
  const userPhone = body.userPhone?.trim() || null;

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      resource_id: body.resourceId,
      user_name: body.userName.trim(),
      user_email: userEmail,
      user_phone: userPhone,
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

  if (userPhone) {
    try {
      await upsertCustomerByPhone(body.userName.trim(), userPhone, body.startISO, supabase);
    } catch (e: any) {
      console.error("Errore aggiornamento rubrica clienti (non bloccante):", e.message);
    }
  }

  const timeLabel = formatBookingTimeLabel(body.startISO, body.endISO);

  await notifyBookingConfirmed({
    customerEmail: userEmail,
    customerName: body.userName.trim(),
    fieldName: resRow.name,
    timeLabel,
    bookingId: data.id,
    totalCents,
    userPhone,
  });

  return NextResponse.json({
    ok: true,
    bookingId: data.id,
    totalCents,
    customerSaved: !!userPhone,
  });
}
