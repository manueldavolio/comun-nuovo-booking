import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  resourceId: string;
  startISO: string;
  endISO: string;
  minutes?: number;
  userName: string;
  userPhone: string;
  payMode?: string;
  sport?: string | null;
};

function calcAmountCents(resourceId: string, minutes: number, sport?: string | null) {
  const hours = minutes / 60;

  // Tendone: calcetto 50€/h, tennis 15€/h
  // Nota: qui non conosciamo il nome della risorsa, quindi usiamo sport come discriminante.
  if (sport === "calcetto") return Math.round(hours * 50 * 100);
  if (sport === "tennis") return Math.round(hours * 15 * 100);

  // fallback base
  return 0;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.resourceId || !body.startISO || !body.endISO || !body.userName) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const start = new Date(body.startISO);
    const end = new Date(body.endISO);

    if (!(start < end)) {
      return NextResponse.json({ error: "Orario non valido" }, { status: 400 });
    }

    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const totalAmountCents = calcAmountCents(body.resourceId, minutes, body.sport ?? null);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        resource_id: body.resourceId,
        user_name: body.userName,
        user_phone: body.userPhone || "",
        start_ts: start.toISOString(),
        end_ts: end.toISOString(),
        status: "CONFIRMED",
        pay_mode: body.payMode || "BAR",
        total_amount_cents: totalAmountCents,
        paid_amount_cents: null,
        paid_method: null,
        paid_at: null,
        payment_note: null,
        sport: body.sport ?? null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, booking: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore creazione prenotazione" },
      { status: 500 }
    );
  }
}

