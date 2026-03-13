import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  bookingId: string;
  email: string;
};

function eurFromCents(cents?: number | null) {
  if (cents == null) return "-";
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.bookingId || !body?.email) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return NextResponse.json({ error: "Email non valida" }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RECEIPT_FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return NextResponse.json(
        { error: "Config email mancante (RESEND_API_KEY / RECEIPT_FROM_EMAIL)" },
        { status: 500 }
      );
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(`
        id,
        user_name,
        user_phone,
        start_ts,
        end_ts,
        total_amount_cents,
        paid_amount_cents,
        paid_at,
        paid_method,
        payment_note,
        resources (
          name
        )
      `)
      .eq("id", body.bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }

    const resourceName =
      Array.isArray((booking as any).resources)
        ? (booking as any).resources?.[0]?.name ?? "-"
        : (booking as any).resources?.name ?? "-";

    const receiptUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/ricevuta/${booking.id}`;

    const subject = `Ricevuta prenotazione - ${resourceName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color:#111; line-height:1.5;">
        <h2 style="margin-bottom:16px;">Ricevuta prenotazione</h2>

        <p>Ciao${booking.user_name ? ` ${booking.user_name}` : ""},</p>
        <p>ti inviamo la ricevuta della tua prenotazione.</p>

        <table style="border-collapse:collapse; width:100%; max-width:560px; margin-top:16px;">
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Spazio</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${resourceName}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Nome</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${booking.user_name ?? "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Telefono</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${booking.user_phone ?? "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Inizio</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${fmtDateTime(booking.start_ts)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Fine</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${fmtDateTime(booking.end_ts)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Totale</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${eurFromCents(booking.total_amount_cents)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Incassato</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${eurFromCents(booking.paid_amount_cents ?? booking.total_amount_cents)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Pagata il</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${fmtDateTime(booking.paid_at)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Metodo</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${booking.paid_method ?? "-"}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd;"><b>Nota</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${booking.payment_note ?? "-"}</td>
          </tr>
        </table>

        <p style="margin-top:20px;">
          Versione stampabile: <a href="${receiptUrl}">${receiptUrl}</a>
        </p>

        <p style="margin-top:24px;">Grazie.</p>
      </div>
    `;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html,
      }),
    });

    const resendJson = await resendResp.json();

    if (!resendResp.ok) {
      return NextResponse.json(
        { error: resendJson?.message || "Errore invio email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, emailId: resendJson.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Errore invio ricevuta" },
      { status: 500 }
    );
  }
}
