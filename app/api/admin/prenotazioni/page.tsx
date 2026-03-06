"use client";

import { useEffect, useMemo, useState } from "react";

type Resource = { id: string; name: string; is_public: boolean; is_active: boolean };
type Slot = { startISO: string; endISO: string };

function formatLocal(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PrenotaPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const publicResources = useMemo(() => resources.filter((r) => r.is_public), [resources]);

  const [resourceId, setResourceId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISODate());
  const [minutes, setMinutes] = useState<60 | 90>(60);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");

  const [payMode, setPayMode] = useState<"FULL" | "DEPOSIT">("DEPOSIT");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/resources");
      const j = await r.json();
      setResources(j.resources ?? []);
    })();
  }, []);

  useEffect(() => {
    setSelectedSlot(null);
    setSlots([]);
    setMsg("");
    if (!resourceId) return;

    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/availability?resourceId=${encodeURIComponent(resourceId)}&date=${encodeURIComponent(
            date
          )}&minutes=${minutes}`
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Errore availability");
        setSlots(j.slots ?? []);
      } catch (e: any) {
        setMsg(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [resourceId, date, minutes]);

    async function goCheckout() {
    if (!resourceId || !selectedSlot) return setMsg("Seleziona spazio e slot.");
    if (!userName.trim() || !userPhone.trim()) return setMsg("Inserisci nome e telefono.");

    setLoading(true);
    setMsg("");

    try {
      const r = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          startISO: selectedSlot.startISO,
          endISO: selectedSlot.endISO,
          minutes,
          payMode,
          userName,
          userPhone,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore checkout");

      window.location.href = j.checkoutUrl;
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function bookNow() {
    if (!resourceId || !selectedSlot) return setMsg("Seleziona spazio e slot.");
    if (!userName.trim() || !userPhone.trim()) return setMsg("Inserisci nome e telefono.");

    setLoading(true);
    setMsg("");

    try {
      const r = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          startISO: selectedSlot.startISO,
          endISO: selectedSlot.endISO,
          minutes,
          userName,
          userPhone,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore prenotazione");

      setMsg("✅ Prenotazione confermata! Pagherai al bar.");

      // ricarica gli slot per far sparire quello prenotato
      const rr = await fetch(
        `/api/availability?resourceId=${encodeURIComponent(resourceId)}&date=${encodeURIComponent(
          date
        )}&minutes=${minutes}`
      );
      const jj = await rr.json();
      setSlots(jj.slots ?? []);
      setSelectedSlot(null);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Prenota</h1>
      <p style={{ marginTop: 6, opacity: 0.8 }}>
        Pagamento online oppure caparra 5€ e saldo al bar.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          <div style={{ fontWeight: 600 }}>Spazio</div>
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="">Seleziona…</option>
            {publicResources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontWeight: 600 }}>Data</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <label>
            <div style={{ fontWeight: 600 }}>Durata</div>
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) as 60 | 90)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Slot disponibili</div>
          {loading && <div>Carico…</div>}
          {!loading && resourceId && slots.length === 0 && <div>Nessuno slot disponibile.</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {slots.map((s) => {
              const active = selectedSlot?.startISO === s.startISO;
              return (
                <button
                  key={s.startISO}
                  onClick={() => setSelectedSlot(s)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: active ? "2px solid #111" : "1px solid #ddd",
                    background: active ? "#f3f3f3" : "white",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{formatLocal(s.startISO)}</div>
                  <div style={{ opacity: 0.7 }}>→ {formatLocal(s.endISO)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          <label>
            <div style={{ fontWeight: 600 }}>Nome</div>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Es. Manuel"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <label>
            <div style={{ fontWeight: 600 }}>Telefono</div>
            <input
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="Es. 3331234567"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontWeight: 600 }}>Pagamento</div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="radio"
                checked={payMode === "DEPOSIT"}
                onChange={() => setPayMode("DEPOSIT")}
              />
              Pago al bar (caparra 5€)
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="radio" checked={payMode === "FULL"} onChange={() => setPayMode("FULL")} />
              Pago online (totale)
            </label>
          </div>
        </div>

        {msg && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#fff3f3",
              border: "1px solid #ffd2d2",
            }}
          >
            {msg}
          </div>
        )}

        <button
          disabled={loading}
          onClick={goCheckout}
          style={{
            marginTop: 8,
            padding: 14,
            borderRadius: 14,
            border: "none",
            background: "#111",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Vai al pagamento
<button
  disabled={loading}
  onClick={bookNow}
  style={{
    padding: 14,
    borderRadius: 14,
    border: "1px solid #111",
    background: "white",
    color: "#111",
    fontWeight: 700,
    cursor: "pointer",
  }}
>
  Prenota e pago al bar
</button>

        </button>
      </div>
    </div>
  );
}