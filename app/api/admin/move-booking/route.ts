import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const bookingId = body.bookingId;
    const startISO = body.startISO;
    const endISO = body.endISO;

    if (!bookingId || !startISO || !endISO) {
      return NextResponse.json(
        { error: "Dati mancanti" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        start_ts: startISO,
        end_ts: endISO,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
