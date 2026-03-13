import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  bookingId: string;
  email: string;
};

function eur(c?: number | null) {
  if (c == null) return "-";
  return (c / 100).toFixed(2).replace(".", ",") + " €";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("it-IT");
}

function fmtTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.bookingId || !body?.email) {
      return NextResponse.json(
        { error: "Dati mancanti" },
        { status: 400 }
      );
    }

    const email = body.email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailOk) {
      return NextResponse.json(
        { error: "Email non valida" },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RECEIPT_FROM_EMAIL;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Manca RESEND_API_KEY su Vercel" },
        { status: 500 }
      );
    }

    if (!fromEmail) {
      return NextResponse.json(
        { error: "Manca RECEIPT_FROM_EMAIL su Vercel" },
        { status: 500 }
      );
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: "Manca NEXT_PUBLIC_SITE_URL su Vercel" },
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
        paid_method,
        paid_at,
        payment_note,
        resources (
          name
        )
      `)
      .eq("id", body.bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: "Prenotazione non trovata" },
        { status: 404 }
      );
    }

    const resourceName = Array.isArray((booking as any).resources)
      ? (booking as any).resources?.[0]?.name ?? "-"
      : (booking as any).resources?.name ?? "-";

    const receiptUrl = `${siteUrl}/admin/ricevuta/${booking.id}`;

    const subject = `Ricevuta prenotazione ${resourceName}`;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
        <h2 style="margin-bottom: 16px;">Ricevuta prenotazione</h2>

        <p>Ciao${booking.user_name ? ` ${booking.user_name}` : ""},</p>
        <p>ti inviamo la ricevuta della tua prenotazione.</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 620px; margin-top: 16px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Spazio</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${resourceName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Cliente</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${booking.user_name ?? "-"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Telefono</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${booking.user_phone ?? "-"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Data</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${fmtDate(booking.start_ts)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Orario</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${fmtTime(booking.start_ts)} - ${fmtTime(booking.end_ts)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Totale</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${eur(booking.total_amount_cents)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Pagato</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${eur(booking.paid_amount_cents ?? booking.total_amount_cents)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Metodo pagamento</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${booking.paid_method ?? "-"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Data pagamento</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${
              booking.paid_at
                ? `${fmtDate(booking.paid_at)} ${fmtTime(booking.paid_at)}`
                : "-"
            }</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><b>Nota</b></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${booking.payment_note ?? "-"}</td>
          </tr>
        </table>

        <p style="margin-top: 20px;">
          Versione stampabile ricevuta:
          <br />
          <a href="${receiptUrl}">${receiptUrl}</a>
        </p>

        <p style="margin-top: 24px;">Grazie.</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html,
      }),
    });

    const resendJson = await resendRes.json();

    if (!resendRes.ok) {
      return NextResponse.json(
        { error: resendJson?.message || "Errore invio email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: resendJson.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Errore invio ricevuta" },
      { status: 500 }
    );
  }
}
