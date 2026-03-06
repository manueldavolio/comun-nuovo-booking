"use client";

import { useEffect, useState } from "react";

type Resource = { id: string; name: string; is_active: boolean; is_public: boolean };

function centsFromEuroInput(v: string) {
  const n = Number((v || "").replace(",", ".").trim());
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function AbbonamentiPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // form
  const [title, setTitle] = useState("Abbonamento");
  const [resourceId, setResourceId] = useState<string>("");
  const [weekday, setWeekday] = useState<number>(2); // 2=martedì
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("22:00");
  const [startDate, setStartDate] = useState("2026-03-01");
  const [endDate, setEndDate] = useState("2026-06-30");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [priceEuro, setPriceEuro] = useState("40,00"); // prezzo fisso per OGNI data

  async function loadResources() {
    setMsg("");
    try {
      // usiamo l'endpoint admin/day solo per ottenere l'elenco resources
      const r = await fetch(`/api/admin/day?date=2026-03-04`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore caricamento risorse");

      const list = (j.resources ?? []).filter((x: any) => x.is_active) as Resource[];
      setResources(list);
      if (!resourceId && list[0]?.id) setResourceId(list[0].id);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  useEffect(() => {
    loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setMsg("");
    const cents = centsFromEuroInput(priceEuro);
    if (cents == null) {
      setMsg("Prezzo non valido (es. 40,00). Deve essere > 0.");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/admin/subscription-create-and-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          resourceId,
          weekday,
          startTime,
          endTime,
          startDate,
          endDate,
          userName,
          userPhone,
          priceCents: cents,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore creazione abbonamento");

      const c = j.conflicts?.length ?? 0;
      setMsg(`OK! Creati ${j.created} slot. Conflitti: ${c}${c ? " (alcune date erano già occupate)" : ""}`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, fontWeight: 950 }}>Abbonamenti</h1>
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
            }}
          >
            Torna al calendario
          </a>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
          Solo admin: genera prenotazioni ricorrenti fino a una data (es. tutti i martedì 20–22).
          Prezzo fisso: ogni data creata avrà lo stesso totale.
        </div>

        <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 16, padding: 14, display: "grid", gap: 10 }}>
          <label>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Titolo</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
          </label>

          <label>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Campo</div>
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Giorno</div>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}>
              <option value={1}>Lunedì</option>
              <option value={2}>Martedì</option>
              <option value={3}>Mercoledì</option>
              <option value={4}>Giovedì</option>
              <option value={5}>Venerdì</option>
              <option value={6}>Sabato</option>
              <option value={7}>Domenica</option>
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Ora inizio (HH:MM)</div>
              <input value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} placeholder="20:00" />
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Solo multipli di 30 (es. 20:00, 20:30)</div>
            </label>
            <label>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Ora fine (HH:MM)</div>
              <input value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} placeholder="22:00" />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Da data</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            </label>
            <label>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Fino a data</div>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Nome</div>
              <input value={userName} onChange={(e) => setUserName(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            </label>
            <label>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Telefono</div>
              <input value={userPhone} onChange={(e) => setUserPhone(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} />
            </label>
          </div>

          <label>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>Prezzo fisso per ogni data (€, es. 40,00)</div>
            <input value={priceEuro} onChange={(e) => setPriceEuro(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }} placeholder="40,00" />
          </label>

          {msg && (
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                background: msg.startsWith("OK") ? "#ecffec" : "#fff3f3",
                border: "1px solid #e5e5e5",
              }}
            >
              {msg}
            </div>
          )}

          <button
            disabled={loading}
            onClick={submit}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 950,
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Creo..." : "Crea abbonamento e genera prenotazioni"}
          </button>
        </div>
      </div>
    </div>
  );
}
