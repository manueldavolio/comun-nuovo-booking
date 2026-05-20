import { Resend } from "resend";

export type BookingEmailParams = {
  customerEmail: string;
  customerName: string;
  fieldName: string;
  timeLabel: string;
  bookingId?: string;
  totalCents?: number | null;
  userPhone?: string | null;
};

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function normalizeEmail(email: string) {
  return (email || "").trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function bookingFromAddress() {
  return (
    process.env.BOOKING_EMAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    "Comun Nuovo <onboarding@resend.dev>"
  );
}

function adminNotificationEmail() {
  return process.env.ADMIN_EMAIL || "info@asibergamo.it";
}

function formatEuro(cents: number | null | undefined) {
  if (cents == null) return null;
  return `${(cents / 100).toFixed(2)} €`;
}

function customerHtml(params: BookingEmailParams) {
  const total = formatEuro(params.totalCents);
  return `
    <h2>Prenotazione confermata</h2>
    <p>Ciao <b>${params.customerName}</b>,</p>
    <p>La tua prenotazione è confermata.</p>
    <p><b>Spazio:</b> ${params.fieldName}</p>
    <p><b>Orario:</b> ${params.timeLabel}</p>
    ${total ? `<p><b>Importo:</b> ${total}</p>` : ""}
    <p style="margin-top:16px;opacity:0.85;">Comun Nuovo – Bergamo</p>
  `;
}

function adminHtml(params: BookingEmailParams) {
  const total = formatEuro(params.totalCents);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const adminLink =
    params.bookingId && siteUrl
      ? `<p><a href="${siteUrl}/admin/calendario">Apri calendario admin</a></p>`
      : "";

  return `
    <h2>Nuova prenotazione</h2>
    <p><b>Nome:</b> ${params.customerName}</p>
    <p><b>Email:</b> ${params.customerEmail}</p>
    <p><b>Telefono:</b> ${params.userPhone?.trim() || "-"}</p>
    <p><b>Spazio:</b> ${params.fieldName}</p>
    <p><b>Orario:</b> ${params.timeLabel}</p>
    ${total ? `<p><b>Importo:</b> ${total}</p>` : ""}
    ${params.bookingId ? `<p><b>ID:</b> ${params.bookingId}</p>` : ""}
    ${adminLink}
  `;
}

/** Invia conferma al cliente e notifica interna. Non lancia errori verso il chiamante. */
export async function sendBookingConfirmationEmails(
  params: BookingEmailParams
): Promise<void> {
  if (!resend) {
    console.log("Email non inviate: RESEND_API_KEY mancante");
    return;
  }

  const to = normalizeEmail(params.customerEmail);
  if (!isValidEmail(to)) {
    console.log("Email cliente non inviata: indirizzo non valido");
    return;
  }

  const subjectBase = `${params.fieldName} – ${params.timeLabel}`;

  try {
    const customerResult = await resend.emails.send({
      from: bookingFromAddress(),
      to,
      subject: `Conferma prenotazione: ${subjectBase}`,
      html: customerHtml(params),
    });
    if (customerResult.error) {
      console.error("Errore email conferma cliente:", customerResult.error);
    }
  } catch (e) {
    console.error("Errore invio email conferma cliente:", e);
  }

  try {
    const adminResult = await resend.emails.send({
      from: bookingFromAddress(),
      to: adminNotificationEmail(),
      subject: `Nuova prenotazione: ${params.customerName} – ${subjectBase}`,
      html: adminHtml(params),
    });
    if (adminResult.error) {
      console.error("Errore email notifica admin:", adminResult.error);
    }
  } catch (e) {
    console.error("Errore invio email notifica admin:", e);
  }
}
