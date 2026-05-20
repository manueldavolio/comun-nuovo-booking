import { sendBookingConfirmationEmails, type BookingEmailParams } from "@/lib/booking-email";

const CENTER_TIME_ZONE = "Europe/Rome";

function normalizePhoneForWhatsApp(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("39")) return digits;
  if (digits.startsWith("0")) return `39${digits.slice(1)}`;
  return `39${digits}`;
}

export function formatBookingTimeLabel(startISO: string, endISO: string) {
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

export async function sendWhatsAppBookingConfirmation(params: {
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

  try {
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
  } catch (e) {
    console.error("Errore invio WhatsApp:", e);
  }
}

/** Email obbligatorie per il flusso; WhatsApp opzionale se c'è il telefono. */
export async function notifyBookingConfirmed(
  params: BookingEmailParams & { userPhone?: string | null }
) {
  try {
    await sendBookingConfirmationEmails(params);
  } catch (e) {
    console.error("Errore invio email post-prenotazione:", e);
  }

  const phone = params.userPhone?.trim();
  if (!phone) return;

  try {
    await sendWhatsAppBookingConfirmation({
      to: phone,
      fieldName: params.fieldName,
      timeLabel: params.timeLabel,
    });
  } catch (e) {
    console.error("Errore invio WhatsApp post-prenotazione:", e);
  }
}

export async function upsertCustomerByPhone(
  name: string,
  phone: string,
  bookingDateISO: string,
  supabase: import("@supabase/supabase-js").SupabaseClient
) {
  const trimmedPhone = phone.trim();
  if (!trimmedPhone) return;

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id, bookings_count")
    .eq("phone", trimmedPhone)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  if (!existing) {
    const { error: insertError } = await supabase.from("customers").insert({
      name,
      phone: trimmedPhone,
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
