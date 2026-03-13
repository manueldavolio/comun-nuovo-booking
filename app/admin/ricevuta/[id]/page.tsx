"use client";

import { useEffect, useState } from "react";

type Booking = {
  id: string;
  user_name: string | null;
  user_phone: string | null;
  start_ts: string;
  end_ts: string;
  total_amount_cents: number | null;
  paid_amount_cents: number | null;
  paid_method: string | null;
  paid_at: string | null;
  status: string | null;
  resources?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

function eur(c?: number | null) {
  if (c == null) return "-";
  return (c / 100).toFixed(2).replace(".", ",") + " €";
}

function hhmm(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ddmmyyhhmm(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RicevutaPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      setLoading(true);

      const r = await fetch(`/api/admin/get-booking?id=${id}`);
      const j = await r.json();

      if (!r.ok) {
        throw new Error(j.error || "Errore caricamento ricevuta");
      }

      setBooking(j.booking ?? null);
    } catch (e: any) {
      alert(e.message || "Errore caricamento ricevuta");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function sendReceipt() {
    if (!email.trim()) {
      alert("Inserisci una mail");
      return;
    }

    try {
      setSending(true);

      const r = await fetch("/api/admin/send-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: id,
          email: email.trim(),
        }),
      });

      const j = await r.json();

      if (!r.ok) {
        throw new Error(j.error || "Errore invio");
      }

      alert("Ricevuta inviata ✅");
      setEmail("");
    } catch (e: any) {
      alert(e.message || "Errore invio");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 30 }}>Carico...</div>;
  }

  if (!booking) {
    return <div style={{ padding: 30 }}>Prenotazione non trovata</div>;
  }

  const resourceName = Array.isArray(booking.resources)
    ? booking.resources?.[0]?.name ?? "Spazio"
    : booking.resources?.name ?? "Spazio";

  const receiptNumber = `N° ${String(booking.id).slice(0, 8).toUpperCase()}`;

  return (
    <div style={{ padding: 24, background: "#f8f8f8", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => window.print()}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Stampa / Salva PDF
          </button>

          <a
            href="/admin/calendario"
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              color: "#111",
              fontWeight: 900,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Torna al calendario
          </a>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <input
            type="email"
            placeholder="Mail cliente"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              minWidth: 280,
              flex: 1,
            }}
          />

          <button
            onClick={sendReceipt}
            disabled={sending}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? "Invio..." : "Invia via mail"}
          </button>
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e5e5",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            <div>
              <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 6 }}>
                ASI Bergamo
              </div>
              <div style={{ opacity: 0.75, lineHeight: 1.6 }}>
                Via Azzurri 2006
                <br />
                P.IVA 04233950163
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 6 }}>
                Ricevuta
              </div>
              <div style={{ opacity: 0.75, lineHeight: 1.7 }}>
                <div>{receiptNumber}</div>
                <div>Data: {ddmmyyhhmm(booking.paid_at || booking.start_ts)}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
                Dati cliente
              </div>
              <div style={{ lineHeight: 1.9 }}>
                <div>
                  <b>Nome:</b> {booking.user_name || "-"}
                </div>
                <div>
                  <b>Telefono:</b> {booking.user_phone || "-"}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
                Dettaglio utilizzo
              </div>
              <div style={{ lineHeight: 1.9 }}>
                <div>
                  <b>Spazio:</b> {resourceName}
                </div>
                <div>
                  <b>Orario:</b> {hhmm(booking.start_ts)}-{hhmm(booking.end_ts)}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
                Pagamento
              </div>
              <div style={{ lineHeight: 1.9 }}>
                <div>
                  <b>Metodo:</b> {booking.paid_method || "-"}
                </div>
                <div>
                  <b>Totale prenotazione:</b> {eur(booking.total_amount_cents)}
                </div>
              </div>
            </div>

            <div style={{ lineHeight: 1.9, paddingTop: 36 }}>
              <div>
                <b>Importo incassato:</b>{" "}
                {eur(booking.paid_amount_cents ?? booking.total_amount_cents)}
              </div>
              <div>
                <b>Stato:</b> {booking.status || "-"}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 26,
              paddingTop: 18,
              borderTop: "1px solid #eee",
              fontSize: 13,
              opacity: 0.65,
            }}
          >
            Documento generato dal gestionale prenotazioni. Conservare per i
            propri archivi.
          </div>
        </div>
      </div>
    </div>
  );
}
