import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  bookingId: string;
  resourceId: string;
  startISO: string;
  endISO: string;
  userName: string;
  userPhone: string;
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

    if (
      !body?.bookingId ||
      !body?.resourceId ||
      !body?.startISO ||
      !body?.endISO ||
      !body?.userName ||
      !body?.userPhone
    ) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const minutes = calcMinutes(body.startISO, body.endISO);
    if (minutes <= 0) {
      return NextResponse.json({ error: "Intervallo orario non valido" }, { status: 400 });
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

    const totalCents = calcTotalCents(resource.name, minutes);

    const { data: conflict, error: conflictError } = await supabase
      .from("bookings")
      .select("id")
      .eq("resource_id", body.resourceId)
      .neq("id", body.bookingId)
      .lt("start_ts", body.endISO)
      .gt("end_ts", body.startISO)
      .limit(1);

    if (conflictError) {
      return NextResponse.json({ error: conflictError.message }, { status: 500 });
    }

    if (conflict && conflict.length > 0) {
      return NextResponse.json({ error: "Slot già occupato da un'altra prenotazione" }, { status: 409 });
    }

    const { data: blockConflict, error: blockConflictError } = await supabase
      .from("blocks")
      .select("id")
      .eq("resource_id", body.resourceId)
      .lt("start_ts", body.endISO)
      .gt("end_ts", body.startISO)
      .limit(1);

    if (blockConflictError) {
      return NextResponse.json({ error: blockConflictError.message }, { status: 500 });
    }

    if (blockConflict && blockConflict.length > 0) {
      return NextResponse.json({ error: "Slot bloccato" }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        resource_id: body.resourceId,
        user_name: body.userName,
        user_phone: body.userPhone,
        start_ts: body.startISO,
        end_ts: body.endISO,
        total_amount_cents: totalCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", body.userPhone)
      .maybeSingle();

    if (existingCustomer?.id) {
      await supabase
        .from("customers")
        .update({
          name: body.userName,
          last_booking_at: body.startISO,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCustomer.id);
    }

    return NextResponse.json({ ok: true, totalCents });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Errore aggiornamento prenotazione" },
      { status: 500 }
    );
  }
}
