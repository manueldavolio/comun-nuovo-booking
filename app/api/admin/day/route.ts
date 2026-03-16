import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Data mancante" }, { status: 400 });
    }

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const [
      { data: resources, error: rErr },
      { data: bookings, error: bErr },
      { data: blocks, error: blErr },
    ] = await Promise.all([
      supabase
        .from("resources")
        .select("*")
        .order("name", { ascending: true }),

      supabase
        .from("bookings")
        .select(`
          id,
          resource_id,
          user_name,
          user_phone,
          start_ts,
          end_ts,
          status,
          pay_mode,
          total_amount_cents,
          paid_amount_cents,
          paid_method,
          paid_at,
          payment_note,
          sport
        `)
        .gte("start_ts", start.toISOString())
        .lte("start_ts", end.toISOString())
        .order("start_ts", { ascending: true }),

      supabase
        .from("admin_blocks")
        .select("*")
        .gte("start_ts", start.toISOString())
        .lte("start_ts", end.toISOString())
        .order("start_ts", { ascending: true }),
    ]);

    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }

    if (bErr) {
      return NextResponse.json({ error: bErr.message }, { status: 500 });
    }

    if (blErr) {
      return NextResponse.json({ error: blErr.message }, { status: 500 });
    }

    return NextResponse.json({
      resources: resources ?? [],
      bookings: bookings ?? [],
      blocks: blocks ?? [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore caricamento giorno" },
      { status: 500 }
    );
  }
}
