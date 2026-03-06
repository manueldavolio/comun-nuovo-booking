"use client";

import { useEffect, useMemo, useState } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string;
  first_booking_at?: string | null;
  last_booking_at?: string | null;
  bookings_count: number;
  notes?: string | null;
  promo_opt_in: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function escapeCsv(value: string | number | boolean | null | undefined) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(";") || s.includes("\n")) {
    return "${s.replace(/"/g, '""')}";
  }
  return s;
}

export default function ClientiPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const r = await fetch("/api/admin/customers");
      const j = await r.json();

      if (!r.ok) {
        throw new Error(j.error || "Errore caricamento clienti");
      }

      setCustomers(j.customers ?? []);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter((c) => {
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  function exportCsv() {
    const header = [
      "Nome",
      "Telefono",
      "Prima prenotazione",
      "Ultima prenotazione",
      "Numero prenotazioni",
      "Consenso promo",
      "Note",
    ];

    const rows = filtered.map((c) => [
      c.name,
      c.phone,
      c.first_booking_at ?? "",
      c.last_booking_at ?? "",
      c.bookings_count ?? 0,
      c.promo_opt_in ? "SI" : "NO",
      c.notes ?? "",
    ]);

    const csv = [
      header.map(escapeCsv).join(";"),
      ...rows.map((row) => row.map(escapeCsv).join(";")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "clienti.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>Clienti</h1>

          <div style={{ display: "flex", gap: 10 }}>
            <a
              href="/admin/calendario"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                textDecoration: "none",
                color: "#111",
                fontWeight: 900,
                background: "white",
              }}
            >
              Torna al calendario
            </a>

            <button
              onClick={exportCsv}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Esporta CSV
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
          Rubrica clienti salvata automaticamente dalle prenotazioni
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca cliente"
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              width: 300,
            }}
          />

          <button
            onClick={load}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Aggiorna
          </button>
        </div>

        {msg && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              background: "#fff3f3",
              border: "1px solid #ffd0d0",
            }}
          >
            {msg}
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            border: "1px solid #eee",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={th}>Nome</th>
                <th style={th}>Telefono</th>
                <th style={th}>Prima prenotazione</th>
                <th style={th}>Ultima prenotazione</th>
                <th style={th}>Prenotazioni</th>
                <th style={th}>Promo</th>
                <th style={th}>Note</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.name}</td>
                  <td style={td}>{c.phone}</td>
                  <td style={td}>{fmtDate(c.first_booking_at)}</td>
                  <td style={td}>{fmtDate(c.last_booking_at)}</td>
                  <td style={td}>{c.bookings_count}</td>
                  <td style={td}>{c.promo_opt_in ? "SI" : "NO"}</td>
                  <td style={td}>{c.notes || "-"}</td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={td}>
                    Nessun cliente trovato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid #eee",
  fontWeight: 900,
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #f3f3f3",
  fontSize: 13,
};