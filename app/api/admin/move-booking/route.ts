import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  bookingId: string;
  resourceId: string;
  startISO: string;
  endISO: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.bookingId || !body.resourceId || !body.startISO || !body.endISO) {
      return NextResponse.json(
        { error: "Dati mancanti" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        resource_id: body.resourceId,
        start_ts: body.startISO,
        end_ts: body.endISO,
      })
      .eq("id", body.bookingId);

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
