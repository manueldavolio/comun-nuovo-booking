"use client";

import { useEffect, useState } from "react";

type Booking = {
  id: string;
  user_name: string;
  user_phone: string;
  start_ts: string;
  end_ts: string;
  total_amount_cents?: number | null;
  paid_amount_cents?: number | null;
  paid_method?: string | null;
  paid_at?: string | null;
};

function eur(c?: number | null) {
  if (!c) return "-";
  return (c / 100).toFixed(2).replace(".", ",") + " €";
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RicevutaPage({ params }: any) {
  const id = params.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const [mail, setMail] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/get-booking?id=${id}`);
    const j = await r.json();
    setBooking(j.booking);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function sendMail() {
    setMsg("");

    if (!mail.trim()) {
      setMsg("Inserisci una mail");
      return;
    }

    try {
      const r = await fetch("/api/admin/send-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: id,
          email: mail,
        }),
      });

      const j = await r.json();

      if (!r.ok) throw new Error(j.error || "Errore invio");

      setMsg("✅ Ricevuta inviata!");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  if (loading) return <div style={{ padding: 30 }}>Carico...</div>;
  if (!booking) return <div style={{ padding: 30 }}>Prenotazione non trovata</div>;

  return (
    <div style={{ padding: 30, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Ricevuta</h1>

      <div style={{ marginTop: 20, lineHeight: 1.7 }}>
        <div><b>Cliente:</b> {booking.user_name}</div>
        <div><b>Telefono:</b> {booking.user_phone}</div>
        <div>
          <b>Orario:</b> {hhmm(booking.start_ts)} – {hhmm(booking.end_ts)}
        </div>

        <div><b>Totale:</b> {eur(booking.total_amount_cents)}</div>
        <div><b>Pagato:</b> {eur(booking.paid_amount_cents)}</div>
        <div><b>Metodo:</b> {booking.paid_method || "-"}</div>
      </div>

      <hr style={{ margin: "30px 0" }} />

      <div style={{ fontWeight: 900 }}>Invia via mail</div>

      <input
        value={mail}
        onChange={(e) => setMail(e.target.value)}
        placeholder="email cliente"
        style={{
          marginTop: 8,
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "1px solid #ddd",
        }}
      />

      <button
        onClick={sendMail}
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          border: "none",
          background: "#111",
          color: "white",
          fontWeight: 900,
          cursor: "pointer",
          width: "100%",
        }}
      >
        Invia ricevuta
      </button>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: "#f4f4f4",
          }}
        >
          {msg}
        </div>
      )}

      <button
        onClick={() => window.print()}
        style={{
          marginTop: 30,
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "white",
          fontWeight: 900,
          width: "100%",
        }}
      >
        Stampa / Salva PDF
      </button>
    </div>
  );
}
