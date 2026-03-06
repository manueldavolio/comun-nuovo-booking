"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Booking = {
  id: string;
  resource_id: string;
  user_name: string;
  user_phone: string;
  start_ts: string;
  end_ts: string;
  status: string;
  pay_mode: string;
  total_amount_cents?: number | null;
  paid_amount_cents?: number | null;
  paid_method?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

type Resource = { id: string; name: string };

function eurFromCents(cents?: number | null) {
  if (cents == null) return "-";
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function dtIt(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export default function RicevutaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [resourceName, setResourceName] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        // carica booking
        const r = await fetch(`/api/admin/booking?id=${encodeURIComponent(id)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Errore caricamento prenotazione");

        const b = j.booking as Booking;
        setBooking(b);

        // nome campo: lo prendiamo dal day endpoint (ok così)
        const dateStr = new Date(b.start_ts).toISOString().slice(0, 10);
        const rr = await fetch(`/api/admin/day?date=${encodeURIComponent(dateStr)}`);
        const jj = await rr.json();
        const resources: Resource[] = jj.resources ?? [];
        const found = resources.find((x) => x.id === b.resource_id);
        setResourceName(found?.name ?? b.resource_id);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [id]);

  if (!id) {
    return <div style={{ padding: 20, opacity: 0.7 }}>ID ricevuta mancante.</div>;
  }

  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Ricevuta</h1>
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fff3f3", border: "1px solid #ffd2d2" }}>
          {err}
        </div>
      </div>
    );
  }

  if (!booking) {
    return <div style={{ padding: 20, opacity: 0.7 }}>Caricamento ricevuta…</div>;
  }

  const paidCents = booking.paid_amount_cents ?? booking.total_amount_cents ?? null;
  const method =
    booking.paid_method === "CASH" ? "Contanti" : booking.paid_method === "CARD" ? "Carta" : "-";

  const receiptNo = booking.id.slice(0, 8).toUpperCase();

  return (
    <div style={{ padding: 20, display: "flex", justifyContent: "center" }}>
      <div style={{ width: 820, maxWidth: "100%" }}>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: "10px 14px",
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
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 900,
              textDecoration: "none",
              color: "#111",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Torna al calendario
          </a>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>ASI Bergamo</div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                Via Azzurri 2006<br />
                P.IVA 04233950163
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 950 }}>Ricevuta</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                N° {receiptNo}<br />
                Data: {dtIt(booking.paid_at ?? booking.created_at ?? new Date().toISOString())}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Dati cliente</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              <div><b>Nome:</b> {booking.user_name}</div>
              <div><b>Telefono:</b> {booking.user_phone}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Dettaglio utilizzo</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              <div><b>Spazio:</b> {resourceName}</div>
              <div><b>Orario:</b> {hhmm(booking.start_ts)}–{hhmm(booking.end_ts)}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 14 }}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Pagamento</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
              <div><b>Metodo:</b> {method}</div>
              <div><b>Importo incassato:</b> {eurFromCents(paidCents)}</div>
              <div><b>Totale prenotazione:</b> {eurFromCents(booking.total_amount_cents ?? null)}</div>
              <div><b>Stato:</b> {booking.paid_at ? "Pagato" : "Non segnato come pagato"}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 14, fontSize: 12, opacity: 0.75 }}>
            Documento generato dal gestionale prenotazioni. Conservare per i propri archivi.
          </div>
        </div>

        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
      </div>
    </div>
  );
}