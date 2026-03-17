import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  bookingId: string;
  resourceId: string;
  startISO: string;
  endISO: string;
};

const PRICE_PER_HOUR_CENTS: Record<string, number> = {
  Palazzetto: 6000,
  Tendone: 5000,
  Sintetico: 5000,
};

function calcTotalCents(
  resourceName: string,
  minutes: number,
  sport?: "CALCETTO" | "TENNIS" | null
) {
  if (resourceName === "Tendone") {
    if (sport === "TENNIS") return Math.round(1500 * (minutes / 60));
    return Math.round(5000 * (minutes / 60));
  }

  const perHour = PRICE_PER_HOUR_CENTS[resourceName] ?? 5000;
  return Math.round(perHour * (minutes / 60));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.bookingId || !body.resourceId || !body.startISO || !body.endISO) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const start = new Date(body.startISO);
    const end = new Date(body.endISO);

    if (!(start < end)) {
      return NextResponse.json({ error: "Orario non valido" }, { status: 400 });
    }

    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);

    // campo destinazione
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

    // recupero booking attuale per sapere sport esistente
    const { data: oldBooking } = await supabase
      .from("bookings")
      .select("sport")
      .eq("id", body.bookingId)
      .single();

    let sport: "CALCETTO" | "TENNIS" | null = null;

    if (resRow.name === "Tendone") {
      sport = oldBooking?.sport === "TENNIS" ? "TENNIS" : "CALCETTO";
    }

    const totalCents = calcTotalCents(resRow.name, minutes, sport);

    const updatePayload: any = {
      resource_id: body.resourceId,
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
      total_amount_cents: totalCents,
      sport: sport,
      payment_note: sport ? `SPORT:${sport}` : null,
    };

    const { data, error } = await supabase
      .from("bookings")
      .update(updatePayload)
      .eq("id", body.bookingId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Errore spostamento prenotazione" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      booking: data,
      totalCents,
      sport,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore spostamento prenotazione" },
      { status: 500 }
    );
  }
}
