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
  minutes: number;
  userName: string;
  userEmail: string;
  userPhone?: string;
  payMode?: "BAR" | "FULL" | "DEPOSIT";
  source?: string | null;
  sport?: "CALCETTO" | "TENNIS" | null;
};

const CENTER_TIME_ZONE = "Europe/Rome";

function getCenterDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: CENTER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function isInsideDailyWindow(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const startParts = getCenterDateParts(start);
  const endParts = getCenterDateParts(end);

  const sameDay =
    startParts.year === endParts.year &&
    startParts.month === endParts.month &&
    startParts.day === endParts.day;
  if (!sameDay) return false;

  const startMinutes = Number(startParts.hour) * 60 + Number(startParts.minute);
  const endMinutes = Number(endParts.hour) * 60 + Number(endParts.minute);
  return startMinutes >= 9 * 60 && endMinutes <= 23 * 60 && endMinutes > startMinutes;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const userEmail = normalizeEmail(body?.userEmail ?? "");

  if (
    !body?.resourceId ||
    !body?.startISO ||
    !body?.endISO ||
    !body?.userName?.trim() ||
    !userEmail ||
    !isValidEmail(userEmail)
  ) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  if (Number(body.minutes) < 60 || Number(body.minutes) > 600) {
    return NextResponse.json({ error: "minutes non validi" }, { status: 400 });
  }
  if (!isInsideDailyWindow(body.startISO, body.endISO)) {
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
    body.startISO,
    normalizedSport
  );

  const userPhone = body.userPhone?.trim() || null;

  const insertPayload: Record<string, unknown> = {
    resource_id: body.resourceId,
    user_name: body.userName.trim(),
    user_email: userEmail,
    user_phone: userPhone,
    start_ts: body.startISO,
    end_ts: body.endISO,
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
    return NextResponse.json(
      { error: "Slot non disponibile (già prenotato)" },
      { status: 409 }
    );
  }

  if (userPhone) {
    try {
      await upsertCustomerByPhone(body.userName.trim(), userPhone, body.startISO, supabase);
    } catch (e: any) {
      console.error("Errore aggiornamento rubrica clienti (non bloccante):", e.message);
    }
  }

  const fieldLabel =
    normalizedSport != null
      ? `${resRow.name} (${normalizedSport.toLowerCase()})`
      : resRow.name;

  const timeLabel = formatBookingTimeLabel(body.startISO, body.endISO);

  await notifyBookingConfirmed({
    customerEmail: userEmail,
    customerName: body.userName.trim(),
    fieldName: fieldLabel,
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
    sport: normalizedSport,
  });
}
