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
  "Saletta palestra": 5000,
  Spogliatoi: 5000,
};

function calcMinutes(startISO: string, endISO: string) {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return Math.round((end - start) / 60000);
}

function calcTotalCents(resourceName: string, minutes: number) {
  const perHour = PRICE_PER_HOUR_CENTS[resourceName] ?? 5000;
  return Math.round(perHour * (minutes / 60));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.bookingId || !body?.resourceId || !body?.startISO || !body?.endISO) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const minutes = calcMinutes(body.startISO, body.endISO);
    if (minutes <= 0) {
      return NextResponse.json({ error: "Intervallo non valido" }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", body.bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }

    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("id, name, is_active")
      .eq("id", body.resourceId)
      .single();

    if (resourceError || !resource) {
      return NextResponse.json({ error: "Risorsa non trovata" }, { status: 404 });
    }

    if (!resource.is_active) {
      return NextResponse.json({ error: "Risorsa non attiva" }, { status: 400 });
    }

    const { data: conflicts, error: conflictsError } = await supabase
      .from("bookings")
      .select("id")
      .eq("resource_id", body.resourceId)
      .neq("id", body.bookingId)
      .lt("start_ts", body.endISO)
      .gt("end_ts", body.startISO)
      .limit(1);

    if (conflictsError) {
      return NextResponse.json({ error: conflictsError.message }, { status: 500 });
    }

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: "Slot già occupato" }, { status: 409 });
    }

    const { data: blockConflicts, error: blockError } = await supabase
      .from("blocks")
      .select("id")
      .eq("resource_id", body.resourceId)
      .lt("start_ts", body.endISO)
      .gt("end_ts", body.startISO)
      .limit(1);

    if (blockError) {
      return NextResponse.json({ error: blockError.message }, { status: 500 });
    }

    if (blockConflicts && blockConflicts.length > 0) {
      return NextResponse.json({ error: "Slot bloccato" }, { status: 409 });
    }

    const totalCents = calcTotalCents(resource.name, minutes);

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        resource_id: body.resourceId,
        start_ts: body.startISO,
        end_ts: body.endISO,
        total_amount_cents: totalCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, totalCents });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Errore spostamento prenotazione" },
      { status: 500 }
    );
  }
}
