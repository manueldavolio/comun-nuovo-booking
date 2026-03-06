import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  bookingId: string;
  paidAmountCents: number;
  paidMethod: "CASH" | "CARD";
  paymentNote?: string;
  updateTotalAlso?: boolean; // se true, aggiorna anche total_amount_cents
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body?.bookingId || !body?.paidAmountCents || !body?.paidMethod) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  const update: any = {
    paid_amount_cents: body.paidAmountCents,
    paid_method: body.paidMethod,
    paid_at: new Date().toISOString(),
    payment_note: body.paymentNote ?? null,
  };

  if (body.updateTotalAlso) {
    update.total_amount_cents = body.paidAmountCents; // “totale ufficiale” = incassato
  }

  const { error } = await supabase.from("bookings").update(update).eq("id", body.bookingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}