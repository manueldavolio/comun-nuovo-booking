import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = { bookingId: string; reason?: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.bookingId) return NextResponse.json({ error: "bookingId mancante" }, { status: 400 });

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "CANCELED",
      canceled_at: new Date().toISOString(),
      canceled_reason: body.reason ?? null,
    })
    .eq("id", body.bookingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}