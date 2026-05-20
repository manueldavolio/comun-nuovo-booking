import { NextResponse } from "next/server";
import {
  formatBookingTimeLabel,
  sendWhatsAppBookingConfirmation,
  upsertCustomerByPhone,
} from "@/lib/booking-notify";
import {
  ensureRomeIso,
  parseWallClockParts,
} from "@/lib/datetime-rome";
import { calcTotalCents } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";

type Body = {
  resourceId: string;
  startISO: string;
  endISO: string;
  minutes: number;
  userName: string;
  userPhone: string;
  payMode?: "BAR" | "FULL" | "DEPOSIT";
  source?: string | null;
  sport?: "CALCETTO" | "TENNIS" | null;
};

function isInsideDailyWindow(startISO: string, endISO: string) {
  const start = parseWallClockParts(startISO);
  const end = parseWallClockParts(endISO);
  if (!start || !end) return false;

  const sameDay =
    start.year === end.year &&
    start.month === end.month &&
    start.day === end.day;
  if (!sameDay) return false;

  const startMinutes = Number(start.hour) * 60 + Number(start.minute);
  const endMinutes = Number(end.hour) * 60 + Number(end.minute);
  return startMinutes >= 9 * 60 && endMinutes <= 23 * 60 && endMinutes > startMinutes;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  console.log("BACKEND RECEIVED", body.startISO, body.endISO);

  const startISO = ensureRomeIso(body.startISO);
  const endISO = ensureRomeIso(body.endISO);

  const userPhone = body?.userPhone?.trim() ?? "";

  if (
    !body?.resourceId ||
    !startISO ||
    !endISO ||
    !body?.userName?.trim() ||
    !userPhone
  ) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  if (Number(body.minutes) < 60 || Number(body.minutes) > 600) {
    return NextResponse.json({ error: "minutes non validi" }, { status: 400 });
  }
  if (!isInsideDailyWindow(startISO, endISO)) {
    return NextResponse.json(
      { error: "Orario non valido: la prenotazione deve restare tra 09:00 e 23:00." },
      { status: 400 }
    );
  }

  const { data: resRow, error: rErr } = await supabase
    .from("resources")
    .select("id, name, is_active")
    .eq("id", body.resourceId)
    .single();

  if (rErr || !resRow) {
    return NextResponse.json({ error: "Risorsa non trovata" }, { status: 404 });
  }

  if (!resRow.is_active) {
    return NextResponse.json({ error: "Risorsa non attiva" }, { status: 400 });
  }

  const isTendone = (resRow.name || "").trim().toLowerCase().includes("tendone");

  const normalizedSport = isTendone
    ? body.sport === "TENNIS"
      ? "TENNIS"
      : "CALCETTO"
    : null;

  const totalCents = calcTotalCents(
    resRow.name,
    body.minutes,
    startISO,
    normalizedSport
  );

  const insertPayload: Record<string, unknown> = {
    resource_id: body.resourceId,
    user_name: body.userName.trim(),
    user_phone: userPhone,
    start_ts: startISO,
    end_ts: endISO,
    status: "CONFIRMED",
    pay_mode: body.payMode ?? "BAR",
    total_amount_cents: totalCents,
    deposit_amount_cents: 500,
    currency: "eur",
    source: body.source ?? null,
    sport: normalizedSport,
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    const rawMessage = error.message || "";
    const overlapViolation =
      error.code === "23P01" ||
      /no_overlaps/i.test(rawMessage) ||
      /overlap/i.test(rawMessage);
    const status = overlapViolation ? 409 : 500;
    const publicError = overlapViolation
      ? "Slot non disponibile (già prenotato)"
      : "Errore creazione prenotazione";

    console.error("CREATE BOOKING DB ERROR", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      overlapViolation,
      insertPayload,
    });

    return NextResponse.json(
      {
        error: publicError,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      { status }
    );
  }

  try {
    await upsertCustomerByPhone(body.userName.trim(), userPhone, startISO, supabase);
  } catch (e: any) {
    console.error("Errore aggiornamento rubrica clienti (non bloccante):", e.message);
  }

  const fieldLabel =
    normalizedSport != null
      ? `${resRow.name} (${normalizedSport.toLowerCase()})`
      : resRow.name;

  try {
    await sendWhatsAppBookingConfirmation({
      to: userPhone,
      fieldName: fieldLabel,
      timeLabel: formatBookingTimeLabel(startISO, endISO),
    });
  } catch (e) {
    console.error("Errore invio WhatsApp post-prenotazione:", e);
  }

  return NextResponse.json({
    ok: true,
    bookingId: data.id,
    totalCents,
    customerSaved: true,
    sport: normalizedSport,
  });
}
