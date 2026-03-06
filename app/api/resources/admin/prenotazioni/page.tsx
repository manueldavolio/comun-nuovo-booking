"use client";

import { useEffect, useMemo, useState } from "react";

type Resource = { id: string; name: string; is_public: boolean; is_active: boolean };
type Booking = {
  id: string;
  resource_id: string;
  user_name: string;
  user_phone: string;
  start_ts: string;
  end_ts: string;
  status: string;
  pay_mode: string;
  created_at: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminPrenotazioni() {
  const [resources, setResources] = useState<Resource[]>([]);
  const byId = useMemo(() => new Map(resources.map((r) => [r.id, r.name])), [resources]);

  const [date, setDate] = useState(todayISODate());
  const [resourceId, setResourceId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (resourceId) params.set("resourceId", resourceId);

      const r = await fetch(`/api/admin/bookings?${params.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore caricamento prenotazioni");
      setBookings(j.bookings ?? []);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/resources");
      const j = await r.json();
      setResources(j.resources ?? []);
    })();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, resourceId]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Prenotazioni (Admin)</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginTop: 12 }}>
        <label>
          <div style={{ fontWeight: 700 }}>Data</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 700 }}>Spazio</div>
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="">Tutti</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={load}
          disabled={loading}
          style={{
            marginTop: 22,
            padding: 12,
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Aggiorna
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fff3f3", border: "1px solid #ffd2d2" }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Inizio", "Fine", "Spazio", "Nome", "Telefono", "Stato", "Pagamento"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmt(b.start_ts)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{fmt(b.end_ts)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{byId.get(b.resource_id) ?? b.resource_id}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{b.user_name}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{b.user_phone}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{b.status}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{b.pay_mode}</td>
              </tr>
            ))}
            {bookings.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                  Nessuna prenotazione trovata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}