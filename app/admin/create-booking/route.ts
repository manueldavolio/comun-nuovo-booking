import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  resourceId: string;
  startISO: string;
  endISO: string;
  minutes: number; // 60 o 90
  userName: string;
  userPhone: string;
  payMode?: "BAR" | "FULL" | "DEPOSIT";
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

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body?.resourceId || !body?.startISO || !body?.endISO || !body?.userName || !body?.userPhone) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }
  if (![60, 90].includes(Number(body.minutes))) {
    return NextResponse.json({ error: "minutes deve essere 60 o 90" }, { status: 400 });
  }

  const { data: resRow, error: rErr } = await supabase
    .from("resources")
    .select("id,name,is_active")
    .eq("id", body.resourceId)
    .single();

  if (rErr || !resRow) return NextResponse.json({ error: "Risorsa non trovata" }, { status: 404 });
  if (!resRow.is_active) return NextResponse.json({ error: "Risorsa non attiva" }, { status: 400 });

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
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Slot non disponibile (già prenotato)" }, { status: 409 });

  return NextResponse.json({ ok: true, bookingId: data.id });
}