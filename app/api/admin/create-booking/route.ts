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
};

const PRICE_PER_HOUR_CENTS: Record<string, number> = {
  Palazzetto: 6000,
  Tendone: 5000,
  Sintetico: 5000,
};

function calcTotalCents(resourceName: string, minutes: number) {
  const perHour = PRICE_PER_HOUR_CENTS[resourceName] ?? 5000;
  return Math.round(perHour * (minutes / 60));
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

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(
    end.getHours()
  )}:${pad(end.getMinutes())}`;
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
      pay_mode: body.payMode ?? "BAR",
      total_amount_cents: totalCents,
      deposit_amount_cents: 500,
      currency: "eur",
      source: body.source ?? null,
    })
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
    await sendWhatsAppBookingConfirmation({
      to: body.userPhone,
      fieldName: resRow.name,
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
  });
}
