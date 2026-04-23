import { NextResponse } from "next/server";
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

const PRICE_PER_HOUR_CENTS: Record<string, number> = {
  Palazzetto: 6000,
  Tendone: 5000,
  Sintetico: 5000,
};
const CENTER_TIME_ZONE = "Europe/Rome";

function calcTotalCents(
  resourceName: string,
  minutes: number,
  sport?: string | null
) {
  const hours = minutes / 60;

  if ((resourceName || "").trim().toLowerCase().includes("tendone")) {
    if (sport === "TENNIS") return Math.round(hours * 15 * 100);
    if (sport === "CALCETTO") return Math.round(hours * 50 * 100);
    return Math.round(5000 * hours);
  }

  const perHour = PRICE_PER_HOUR_CENTS[resourceName] ?? 5000;
  return Math.round(perHour * hours);
}

function normalizePhoneForWhatsApp(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("39")) return digits;
  if (digits.startsWith("0")) return `39${digits.slice(1)}`;

  return `39${digits}`;
}

function formatTimeLabel(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const startParts = getCenterDateParts(start);
  const endParts = getCenterDateParts(end);

  const dateLabel = `${startParts.day}/${startParts.month}/${startParts.year}`;
  const timeLabel = `${startParts.hour}:${startParts.minute} - ${endParts.hour}:${endParts.minute}`;

  return `${dateLabel} • ${timeLabel}`;
}

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

async function sendWhatsAppBookingConfirmation(params: {
  to: string;
  fieldName: string;
  timeLabel: string;
}) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log("WhatsApp non configurato: manca token o phone number id");
    return;
  }

  const to = normalizePhoneForWhatsApp(params.to);

  if (!to) {
    console.log("WhatsApp non inviato: numero non valido");
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "prenotazione",
          language: { code: "it" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.fieldName },
                { type: "text", text: params.timeLabel },
              ],
            },
          ],
        },
      }),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    console.error("Errore invio WhatsApp:", json);
  } else {
    console.log("WhatsApp inviato:", json);
  }
}

async function upsertCustomer(
  name: string,
  phone: string,
  bookingDateISO: string
) {
  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id, bookings_count")
    .eq("phone", phone)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  if (!existing) {
    const { error: insertError } = await supabase.from("customers").insert({
      name,
      phone,
      first_booking_at: bookingDateISO,
      last_booking_at: bookingDateISO,
      bookings_count: 1,
    });

    if (insertError) throw new Error(insertError.message);
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

  if (updateError) throw new Error(updateError.message);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (
    !body?.resourceId ||
    !body?.startISO ||
    !body?.endISO ||
    !body?.userName ||
    !body?.userPhone
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
    return NextResponse.json(
      { error: "Risorsa non trovata" },
      { status: 404 }
    );
  }

  if (!resRow.is_active) {
    return NextResponse.json(
      { error: "Risorsa non attiva" },
      { status: 400 }
    );
  }

  const isTendone = (resRow.name || "").trim().toLowerCase().includes("tendone");

  const normalizedSport = isTendone
    ? body.sport === "TENNIS"
      ? "TENNIS"
      : "CALCETTO"
    : null;

  const totalCents = calcTotalCents(resRow.name, body.minutes, normalizedSport);

  const insertPayload: Record<string, any> = {
    resource_id: body.resourceId,
    user_name: body.userName,
    user_phone: body.userPhone,
    start_ts: body.startISO,
    end_ts: body.endISO,
    status: "CONFIRMED",
    pay_mode: body.payMode ?? "BAR",
    total_amount_cents: totalCents,
    deposit_amount_cents: 500,
    currency: "eur",
    source: body.source ?? null,
  };

  insertPayload.sport = normalizedSport;

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

  try {
    const fieldLabel =
      normalizedSport != null
        ? `${resRow.name} (${normalizedSport.toLowerCase()})`
        : resRow.name;

    await sendWhatsAppBookingConfirmation({
      to: body.userPhone,
      fieldName: fieldLabel,
      timeLabel: formatTimeLabel(body.startISO, body.endISO),
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
