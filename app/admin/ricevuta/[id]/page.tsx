"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RicevutaPage() {
  const params = useParams();
  const id = params?.id as string;

  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/admin/get-booking?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        setBooking(data.booking);
      });
  }, [id]);

  if (!booking) {
    return <div style={{ padding: 40 }}>Carico...</div>;
  }

  const startDate = new Date(booking.start_ts);
  const endDate = new Date(booking.end_ts);

  const data = startDate.toLocaleDateString("it-IT");
  const start = startDate.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = endDate.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const importo = booking.total_amount_cents
    ? `€ ${(booking.total_amount_cents / 100).toFixed(2)}`
    : "-";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f6f6",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
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
              fontWeight: 800,
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
              fontWeight: 800,
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
            background: "white",
            border: "1px solid #e5e5e5",
            borderRadius: 20,
            padding: 28,
            boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            <div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>ASI Bergamo</div>
              <div style={{ marginTop: 8, color: "#666", lineHeight: 1.6 }}>
                Via Azzurri 2006
                <br />
                P.IVA 04233950163
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 34, fontWeight: 900 }}>Ricevuta</div>
              <div style={{ marginTop: 8, color: "#666", lineHeight: 1.6 }}>
                <div>N° {String(booking.id).slice(0, 8).toUpperCase()}</div>
                <div>Data: {data}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              marginBottom: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
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
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
                Dettaglio utilizzo
              </div>

              <div style={{ lineHeight: 1.9 }}>
                <div>
                  <b>Spazio:</b> Palazzetto
                </div>
                <div>
                  <b>Orario:</b> {start} - {end}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
                Pagamento
              </div>

              <div style={{ lineHeight: 1.9 }}>
                <div>
                  <b>Metodo:</b> {booking.paid_method || "Contanti"}
                </div>
                <div>
                  <b>Totale prenotazione:</b> {importo}
                </div>
              </div>
            </div>

            <div style={{ paddingTop: 36, lineHeight: 1.9 }}>
              <div>
                <b>Importo incassato:</b>{" "}
                {booking.paid_amount_cents
                  ? `€ ${(booking.paid_amount_cents / 100).toFixed(2)}`
                  : importo}
              </div>
              <div>
                <b>Stato:</b> {booking.status || "Pagato"}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 26,
              paddingTop: 18,
              borderTop: "1px solid #eee",
              fontSize: 13,
              color: "#777",
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
