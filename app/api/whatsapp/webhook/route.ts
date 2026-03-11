import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizePhoneForWhatsApp(phone: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("39")) return digits;
  if (digits.startsWith("0")) return `39${digits.slice(1)}`;
  return `39${digits}`;
}

function parseItalianBookingMessage(text: string) {
  const raw = (text || "").trim();
  const lower = raw.toLowerCase();

  if (!lower.includes("prenot")) return null;

  let resourceName = "";
  if (lower.includes("palazzetto")) resourceName = "Palazzetto";
  else if (lower.includes("tendone")) resourceName = "Tendone";
  else if (lower.includes("sintetico")) resourceName = "Sintetico";

  const dayMonthMatch = raw.match(
    /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/i
  );

  const timeMatch = raw.match(/\balle\s+(\d{1,2})(?::(\d{2}))?\b/i);

  const phoneMatch = raw.match(/(\+?39)?\s*3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/);

  const nameMatch = raw.match(/\bnome\s+([a-zàèéìòù' ]{2,40})/i);

  const monthMap: Record<string, number> = {
    gennaio: 1,
    febbraio: 2,
    marzo: 3,
    aprile: 4,
    maggio: 5,
    giugno: 6,
    luglio: 7,
    agosto: 8,
    settembre: 9,
    ottobre: 10,
    novembre: 11,
    dicembre: 12,
  };

  if (!resourceName || !dayMonthMatch || !timeMatch || !phoneMatch || !nameMatch) {
    return null;
  }

  const day = Number(dayMonthMatch[1]);
  const monthName = dayMonthMatch[2].toLowerCase();
  const month = monthMap[monthName];
  const year = new Date().getFullYear();

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || "00");

  const userPhone = normalizePhoneForWhatsApp(phoneMatch[0]);
  const userName = nameMatch[1].trim();

  const yyyy = String(year);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");

  return {
    resourceName,
    userName,
    userPhone,
    startISO: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`,
    minutes: 60,
  };
}

async function sendWhatsAppText(to: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return;

  const cleanTo = normalizePhoneForWhatsApp(to);
  if (!cleanTo) return;

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
        to: cleanTo,
        type: "text",
        text: { body: text },
      }),
    }
  );

  const json = await response.json();
  if (!response.ok) {
    console.error("Errore invio testo WhatsApp:", json);
  }
}

export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";

  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge || "", { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const msg = messages[0];
    const from = msg?.from || "";
    const text = msg?.text?.body || "";

    if (!from || !text) {
      return NextResponse.json({ ok: true });
    }

    const parsed = parseItalianBookingMessage(text);

    if (!parsed) {
      await sendWhatsAppText(
        from,
        "Formato non riconosciuto.\nScrivi ad esempio:\nPrenoto il palazzetto il 12 marzo alle 20. Nome Manuel 3937087885"
      );
      return NextResponse.json({ ok: true });
    }

    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("id, name, is_active")
      .eq("name", parsed.resourceName)
      .maybeSingle();

    if (resourceError || !resource) {
      await sendWhatsAppText(from, `Risorsa non trovata: ${parsed.resourceName}`);
      return NextResponse.json({ ok: true });
    }

    if (!resource.is_active) {
      await sendWhatsAppText(from, `La risorsa ${resource.name} non è attiva.`);
      return NextResponse.json({ ok: true });
    }

    const start = new Date(parsed.startISO);
    const end = new Date(start.getTime() + parsed.minutes * 60 * 1000);
    const endISO = end.toISOString().slice(0, 19);

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://prenotazionicomunnuovo.vercel.app";

    const bookingResponse = await fetch(`${baseUrl}/api/admin/create-booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceId: resource.id,
        startISO: parsed.startISO,
        endISO,
        minutes: parsed.minutes,
        userName: parsed.userName,
        userPhone: parsed.userPhone,
        payMode: "BAR",
        source: "whatsapp",
      }),
    });

    const bookingJson = await bookingResponse.json();

    if (!bookingResponse.ok) {
      await sendWhatsAppText(
        from,
        `Prenotazione non riuscita: ${bookingJson?.error || "errore sconosciuto"}`
      );
      return NextResponse.json({ ok: true });
    }

    await sendWhatsAppText(
      from,
      `Prenotazione inserita ✅\nCampo: ${resource.name}\nData/ora: ${parsed.startISO.replace("T", " ")}`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Errore webhook WhatsApp:", error);
    return NextResponse.json({ ok: true });
  }
}
