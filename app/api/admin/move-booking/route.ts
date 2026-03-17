import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  bookingId: string;
  resourceId: string;
  startISO: string;
  endISO: string;
  sport?: "CALCETTO" | "TENNIS" | null;
};

const PRICE_PER_HOUR_CENTS: Record<string, number> = {
  Palazzetto: 6000,
  Tendone: 5000,
  Sintetico: 5000,
};

function calcTotalCents(resourceName: string, minutes: number, sport?: string | null) {
  const hours = minutes / 60;

  if ((resourceName || "").trim().toLowerCase().includes("tendone")) {
    if (sport === "TENNIS") return Math.round(hours * 15 * 100);
    if (sport === "CALCETTO") return Math.round(hours * 50 * 100);
    return Math.round(5000 * hours);
  }

  const perHour = PRICE_PER_HOUR_CENTS[resourceName] ?? 5000;
  return Math.round(perHour * hours);
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

    const normalizedSport =
      isTendone
        ? body.sport === "TENNIS"
          ? "TENNIS"
          : "CALCETTO"
        : null;

    const totalCents = calcTotalCents(resRow.name, minutes, normalizedSport);

    const updatePayload: Record<string, any> = {
      resource_id: body.resourceId,
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
      total_amount_cents: totalCents,
    };

    updatePayload.sport = normalizedSport;

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
      sport: normalizedSport,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore spostamento prenotazione" },
      { status: 500 }
    );
  }
}
