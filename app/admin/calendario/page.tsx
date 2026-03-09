"use client";

import { useEffect, useMemo, useState } from "react";

type Resource = { id: string; name: string; is_active: boolean; is_public: boolean };

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
  deposit_amount_cents?: number | null;
  paid_amount_cents?: number | null;
  paid_method?: string | null;
  paid_at?: string | null;
  payment_note?: string | null;
};

type Block = {
  id: string;
  resource_id: string;
  start_ts: string;
  end_ts: string;
  reason?: string | null;
  note?: string | null;
};

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function eurFromCents(cents?: number | null) {
  if (cents == null) return "-";
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function getSchedule(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 dom, 6 sab
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return { openH: 8, openM: 0, closeH: 23, closeM: 0 };
  return { openH: 15, openM: 30, closeH: 23, closeM: 0 };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function CalendarioAdmin() {
  const [date, setDate] = useState(todayISODate());
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const STEP_MIN = 30;
  const { openH, openM, closeH, closeM } = getSchedule(date);

  const timeColW = 78;
  const colW = 260;
  const rowH = 46;

  const dayBase = useMemo(() => new Date(`${date}T00:00:00.000Z`).getTime(), [date]);
  const dayStart = useMemo(() => dayBase + (openH * 60 + openM) * 60 * 1000, [dayBase, openH, openM]);
  const dayEnd = useMemo(() => dayBase + (closeH * 60 + closeM) * 60 * 1000, [dayBase, closeH, closeM]);

  const timeRows = useMemo(() => {
    const rows: { label: string; t: number }[] = [];
    for (let t = dayStart; t < dayEnd; t += STEP_MIN * 60 * 1000) {
      rows.push({
        label: new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        t,
      });
    }
    return rows;
  }, [dayStart, dayEnd]);

  const gridH = timeRows.length * rowH;

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/day?date=${encodeURIComponent(date)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore caricamento");

      setResources((j.resources ?? []).filter((x: any) => x.is_active));
      setBookings(j.bookings ?? []);
      setBlocks(j.blocks ?? []);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [date]);

  const items = useMemo(() => {
    const all: Array<
      | {
          type: "BOOKING";
          id: string;
          resource_id: string;
          start: number;
          end: number;
          title: string;
          subtitle: string;
          badge: string;
          booking: Booking;
        }
      | {
          type: "BLOCK";
          id: string;
          resource_id: string;
          start: number;
          end: number;
          title: string;
          subtitle: string;
          badge: string;
          block: Block;
        }
    > = [];

    for (const b of bookings) {
      const s = new Date(b.start_ts).getTime();
      const e = new Date(b.end_ts).getTime();
      const paid = !!b.paid_at;

      all.push({
        type: "BOOKING",
        id: b.id,
        resource_id: b.resource_id,
        start: s,
        end: e,
        title: b.user_name || "Prenotazione",
        subtitle: `${hhmm(b.start_ts)}–${hhmm(b.end_ts)} • ${b.user_phone ?? ""}`.trim(),
        badge: paid ? "Pagata" : "Da pagare",
        booking: b,
      });
    }

    for (const bl of blocks) {
      const s = new Date(bl.start_ts).getTime();
      const e = new Date(bl.end_ts).getTime();

      all.push({
        type: "BLOCK",
        id: bl.id,
        resource_id: bl.resource_id,
        start: s,
        end: e,
        title: "Bloccato",
        subtitle: `${hhmm(bl.start_ts)}–${hhmm(bl.end_ts)}${bl.reason ? ` • ${bl.reason}` : bl.note ? ` • ${bl.note}` : ""}`,
        badge: "Blocco",
        block: bl,
      });
    }

    return all;
  }, [bookings, blocks]);

  const itemsByRes = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const r of resources) map.set(r.id, []);
    for (const it of items) {
      const arr = map.get(it.resource_id) ?? [];
      arr.push(it);
      map.set(it.resource_id, arr);
    }
    for (const [k, arr] of map.entries()) arr.sort((a, b) => a.start - b.start);
    return map;
  }, [resources, items]);

  function topPx(t: number) {
    const diffMin = (t - dayStart) / (60 * 1000);
    return (diffMin / STEP_MIN) * rowH;
  }

  function heightPx(s: number, e: number) {
    const diffMin = (e - s) / (60 * 1000);
    return (diffMin / STEP_MIN) * rowH;
  }

  // ----- NUOVA PRENOTAZIONE / BLOCCO -----
  const [newOpen, setNewOpen] = useState(false);
  const [newResourceId, setNewResourceId] = useState<string>("");
  const [newStartISO, setNewStartISO] = useState<string>("");
  const [newMinutes, setNewMinutes] = useState<number>(60);
  const [newName, setNewName] = useState<string>("");
  const [newPhone, setNewPhone] = useState<string>("");
  const [newErr, setNewErr] = useState<string>("");

  function openNewBooking(resourceId: string, startT: number) {
    const startISO = new Date(startT).toISOString();
    setNewResourceId(resourceId);
    setNewStartISO(startISO);
    setNewMinutes(60);
    setNewName("");
    setNewPhone("");
    setNewErr("");
    setNewOpen(true);
  }

  async function submitNewBooking() {
    setNewErr("");
    try {
      const endISO = new Date(new Date(newStartISO).getTime() + newMinutes * 60 * 1000).toISOString();

      const r = await fetch("/api/admin/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceId: newResourceId,
          startISO: newStartISO,
          endISO,
          minutes: newMinutes,
          userName: newName,
          userPhone: newPhone,
          payMode: "BAR",
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore creazione prenotazione");

      setNewOpen(false);
      await load();
    } catch (e: any) {
      setNewErr(e.message);
    }
  }

  async function createBlock() {
    setNewErr("");
    try {
      const reason = prompt("Motivo blocco campo (es. Allenamento, Evento, Manutenzione)");
      if (!reason) return;

      const endISO = new Date(new Date(newStartISO).getTime() + newMinutes * 60 * 1000).toISOString();

      const r = await fetch("/api/admin/create-block", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resource_id: newResourceId,
          start_ts: newStartISO,
          end_ts: endISO,
          reason,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore creazione blocco");

      setNewOpen(false);
      await load();
    } catch (e: any) {
      setNewErr(e.message);
    }
  }

  // ----- DETTAGLIO PRENOTAZIONE -----
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD">("CASH");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [updateTotalAlso, setUpdateTotalAlso] = useState<boolean>(true);
  const [detailErr, setDetailErr] = useState<string>("");

  function openDetail(b: Booking) {
    setDetailBooking(b);

    const baseCents = b.paid_amount_cents ?? b.total_amount_cents ?? null;
    setPayAmount(baseCents != null ? String((baseCents / 100).toFixed(2)).replace(".", ",") : "");
    setPayMethod("CASH");
    setPaymentNote(b.payment_note ?? "");
    setUpdateTotalAlso(true);
    setDetailErr("");
    setDetailOpen(true);
  }

  async function markPaid() {
    if (!detailBooking) return;

    setDetailErr("");

    const normalized = (payAmount || "").replace(",", ".").trim();
    const num = Number(normalized);
    if (!isFinite(num) || num <= 0) {
      setDetailErr("Importo non valido");
      return;
    }

    const cents = Math.round(num * 100);

    try {
      const r = await fetch("/api/admin/mark-paid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: detailBooking.id,
          paidAmountCents: cents,
          paidMethod: payMethod,
          paymentNote,
          updateTotalAlso,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore pagamento");

      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setDetailErr(e.message);
    }
  }

  async function cancelBooking() {
    if (!detailBooking) return;

    const reason = prompt("Motivo disdetta (opzionale):") ?? "";

    try {
      const r = await fetch("/api/admin/cancel-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: detailBooking.id,
          reason,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore disdetta");

      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setDetailErr(e.message);
    }
  }

  const nowLineTop = useMemo(() => {
    const now = Date.now();
    if (now < dayStart || now > dayEnd) return null;
    return topPx(now);
  }, [dayStart, dayEnd]);

  const minWidth = timeColW + resources.length * colW;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 1700, margin: "0 auto" }}>
        <img src="/logo.png" style={{ height: 80, marginBottom: 20 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginRight: 12 }}>Calendario</h1>

          <label>
            <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Data</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <button
            onClick={load}
            disabled={loading}
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
            Aggiorna
          </button>

          <a
            href="/admin/abbonamenti"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              color: "#111",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            Abbonamenti
          </a>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "#e9ecef", fontWeight: 800 }}>
              ✅ Prenotato
            </span>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "#d9f5d9", fontWeight: 800 }}>
              💶 Pagata
            </span>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ffe8cc", fontWeight: 800 }}>
              ⛔ Bloccato
            </span>
          </div>
        </div>

        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
          Orari: {String(openH).padStart(2, "0")}:{String(openM).padStart(2, "0")} – {String(closeH).padStart(2, "0")}:
          {String(closeM).padStart(2, "0")} (step 30 min). • Click su slot vuoto = prenotazione o blocco campo.
        </div>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "#fff3f3",
              border: "1px solid #ffd2d2",
            }}
          >
            {msg}
          </div>
        )}

        <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 14, overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${timeColW}px repeat(${resources.length}, ${colW}px)`,
              position: "sticky",
              top: 0,
              zIndex: 5,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
              minWidth,
            }}
          >
            <div style={{ padding: 10, fontWeight: 900, borderRight: "1px solid #eee" }} />
            {resources.map((r) => (
              <div
                key={r.id}
                style={{ padding: 10, fontWeight: 900, borderRight: "1px solid #eee", whiteSpace: "nowrap" }}
              >
                {r.name}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `${timeColW}px 1fr`, minWidth }}>
            <div style={{ borderRight: "1px solid #eee" }}>
              {timeRows.map((t, i) => (
                <div key={i} style={{ height: rowH, padding: "12px 8px", fontSize: 12, fontWeight: 900, opacity: 0.7 }}>
                  {t.label}
                </div>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${resources.length}, ${colW}px)` }}>
                {resources.map((r) => (
                  <div key={r.id} style={{ position: "relative", height: gridH, borderRight: "1px solid #f0f0f0" }}>
                    {timeRows.map((tr, idx) => (
                      <div
                        key={idx}
                        onClick={() => openNewBooking(r.id, tr.t)}
                        style={{
                          height: rowH,
                          borderBottom: "1px solid #f6f6f6",
                          cursor: "pointer",
                        }}
                        title="Clicca per inserire prenotazione o bloccare il campo"
                      />
                    ))}

                    {(itemsByRes.get(r.id) ?? []).map((it: any) => {
                      const top = clamp(topPx(it.start), 0, gridH);
                      const h = clamp(heightPx(it.start, it.end), 28, gridH - top);
                      const isBlock = it.type === "BLOCK";
                      const paid = it.type === "BOOKING" ? !!it.booking?.paid_at : false;

                      return (
                        <div
                          key={it.id}
                          onClick={() => {
                            if (it.type === "BOOKING") openDetail(it.booking);
                          }}
                          title={`${it.title}\n${it.subtitle}`}
                          style={{
                            position: "absolute",
                            left: 10,
                            right: 10,
                            top,
                            height: h,
                            borderRadius: 12,
                            background: isBlock ? "#ffe8cc" : paid ? "#d9f5d9" : "#e9ecef",
                            border: isBlock ? "1px solid #f1c27d" : paid ? "1px solid #9ad19a" : "1px solid #d0d0d0",
                            padding: 10,
                            boxSizing: "border-box",
                            overflow: "hidden",
                            cursor: it.type === "BOOKING" ? "pointer" : "default",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div
                              style={{
                                fontWeight: 950,
                                fontSize: 13,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {it.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 950,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: isBlock ? "#fff3df" : paid ? "#ecffec" : "#f6f6f6",
                                border: "1px solid rgba(0,0,0,0.08)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {it.badge}
                            </div>
                          </div>

                          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, opacity: 0.85 }}>{it.subtitle}</div>

                          {it.type === "BOOKING" && it.booking?.total_amount_cents != null && (
                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 950 }}>
                              Totale: {eurFromCents(it.booking.total_amount_cents)}
                              {it.booking?.paid_at ? (
                                <> • Incassato: {eurFromCents(it.booking.paid_amount_cents ?? it.booking.total_amount_cents ?? null)}</>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {nowLineTop !== null && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: nowLineTop,
                    height: 2,
                    background: "#1e90ff",
                    opacity: 0.55,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* MODAL NUOVA PRENOTAZIONE / BLOCCO */}
        {newOpen && (
          <div
            onClick={() => setNewOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 50,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 460,
                maxWidth: "100%",
                background: "white",
                borderRadius: 16,
                border: "1px solid #eee",
                padding: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 950 }}>Nuovo slot</div>
              <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
                Orario: {hhmm(newStartISO)} • Data: {date}
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <label>
                  <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Durata</div>
                  <select
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </label>

                <label>
                  <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Nome</div>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                <label>
                  <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Telefono</div>
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                </label>

                {newErr && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#fff3f3",
                      border: "1px solid #ffd2d2",
                    }}
                  >
                    {newErr}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <button
                    onClick={createBlock}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #e6b35c",
                      background: "#fff4df",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Blocca campo
                  </button>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setNewOpen(false)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #ddd",
                        background: "white",
                        fontWeight: 900,
                      }}
                    >
                      Chiudi
                    </button>

                    <button
                      onClick={submitNewBooking}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "none",
                        background: "#111",
                        color: "white",
                        fontWeight: 900,
                      }}
                    >
                      Salva prenotazione
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DETTAGLIO PRENOTAZIONE */}
        {detailOpen && detailBooking && (
          <div
            onClick={() => setDetailOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 60,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 560,
                maxWidth: "100%",
                background: "white",
                borderRadius: 16,
                border: "1px solid #eee",
                padding: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 950 }}>Prenotazione</div>
              <div style={{ marginTop: 6, display: "grid", gap: 4, fontSize: 13, opacity: 0.88 }}>
                <div><b>Nome:</b> {detailBooking.user_name}</div>
                <div><b>Telefono:</b> {detailBooking.user_phone}</div>
                <div><b>Orario:</b> {hhmm(detailBooking.start_ts)}–{hhmm(detailBooking.end_ts)} • {date}</div>
                <div><b>Totale:</b> {eurFromCents(detailBooking.total_amount_cents ?? null)}</div>
                <div><b>Stato pagamento:</b> {detailBooking.paid_at ? "Pagata" : "Da pagare"}</div>
                {detailBooking.payment_note ? <div><b>Nota:</b> {detailBooking.payment_note}</div> : null}
              </div>

              <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                <div style={{ fontWeight: 950 }}>Segna pagato</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <label>
                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Importo (€)</div>
                    <input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                      placeholder="es. 60,00"
                    />
                  </label>

                  <label>
                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Metodo</div>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as any)}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      <option value="CASH">Contanti</option>
                      <option value="CARD">Carta</option>
                    </select>
                  </label>
                </div>

                <label style={{ marginTop: 10, display: "block" }}>
                  <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Nota pagamento</div>
                  <input
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", marginTop: 6 }}
                    placeholder="es. sconto, saldo, promo..."
                  />
                </label>

                <label style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={updateTotalAlso}
                    onChange={(e) => setUpdateTotalAlso(e.target.checked)}
                  />
                  <span style={{ fontWeight: 900, fontSize: 13 }}>
                    Aggiorna anche il totale prenotazione con l’importo incassato
                  </span>
                </label>

                {detailErr && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 12,
                      background: "#fff3f3",
                      border: "1px solid #ffd2d2",
                    }}
                  >
                    {detailErr}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 14, flexWrap: "wrap" }}>
                  <button
                    onClick={cancelBooking}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #ffb3b3",
                      background: "#fff5f5",
                      fontWeight: 950,
                    }}
                  >
                    Disdici prenotazione
                  </button>

                  <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
                    <a
                      href={`/admin/ricevuta/${detailBooking.id}`}
                      target="_blank"
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #ddd",
                        background: "white",
                        fontWeight: 950,
                        textDecoration: "none",
                        color: "#111",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      Ricevuta
                    </a>

                    <button
                      onClick={markPaid}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "none",
                        background: "#111",
                        color: "white",
                        fontWeight: 950,
                      }}
                    >
                      Segna pagato
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  Tip: “Ricevuta” apre una pagina stampabile (poi fai Stampa → Salva PDF).
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
