import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bookingId, email } = body;

    if (!bookingId || !email) {
      return NextResponse.json({ error: "bookingId o email mancanti" }, { status: 400 });
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }

    const receiptUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/admin/ricevuta/${bookingId}`;

    await resend.emails.send({
      from: "Comun Nuovo <onboarding@resend.dev>",
      to: email,
      subject: "Ricevuta prenotazione",
      html: `
        <h2>Ricevuta prenotazione</h2>
        <p><b>Nome:</b> ${booking.user_name}</p>
        <p><b>Telefono:</b> ${booking.user_phone}</p>
        <p><b>Orario:</b> ${booking.start_ts} → ${booking.end_ts}</p>
        <p><b>Totale:</b> ${(booking.total_amount_cents / 100).toFixed(2)} €</p>
        <br/>
        <a href="${receiptUrl}">Apri ricevuta</a>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
