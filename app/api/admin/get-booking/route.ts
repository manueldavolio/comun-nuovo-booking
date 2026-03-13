import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID mancante" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bookings")
      .select(`
        id,
        user_name,
        user_phone,
        start_ts,
        end_ts,
        total_amount_cents,
        paid_amount_cents,
        paid_method,
        paid_at,
        status,
        resources (
          name
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Prenotazione non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      booking: data,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore get-booking" },
      { status: 500 }
    );
  }
}
