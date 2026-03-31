"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Resource = {
  id: string;
  name: string;
  is_active: boolean;
  is_public: boolean;
};

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
  payment_note?: string | null;
};

type Block = {
  id: string;
  resource_id: string;
  start_ts: string;
  end_ts: string;
  note?: string | null;
};

type WeekDaySummary = {
  date: string;
  label: string;
  bookingsCount: number;
  paidCount: number;
  unpaidCount: number;
  totalCents: number;
};

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekISO(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay(); // 0 dom - 6 sab
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function italianWeekdayShort(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eurFromCents(cents?: number | null) {
  if (cents == null) return "-";
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function getSchedule(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return { openH: 8, openM: 0, closeH: 23, closeM: 0 };
  return { openH: 9, openM: 0, closeH: 23, closeM: 0 };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pricePreview(resourceName: string, sport: string, minutes: number) {
  if (resourceName === "Tendone") {
    const perHour = sport === "TENNIS" ? 1500 : 5000;
    return Math.round(perHour * (minutes / 60));
  }
  if (resourceName === "Palazzetto") return Math.round(6000 * (minutes / 60));
  return Math.round(5000 * (minutes / 60));
}

export default function CalendarioAdmin() {
  const [date, setDate] = useState(todayISODate());
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [weekSummary, setWeekSummary] = useState<WeekDaySummary[]>([]);
  const [zoom, setZoom] = useState(1);

  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartZoom = useRef<number>(1);

  const STEP_MIN = 30;
  const { openH, openM, closeH, closeM } = getSchedule(date);

  const baseTimeColW = 64;
  const baseColW = 220;
  const baseRowH = 52;

  const timeColW = Math.round(baseTimeColW * zoom);
  const colW = Math.round(baseColW * zoom);
  const rowH = Math.round(baseRowH * zoom);

  const resourceOrder = ["Palazzetto", "Tendone", "Saletta palestra", "Spogliatoi"];

  const orderedResources = useMemo(() => {
    return [...resources].sort((a, b) => {
      const ai = resourceOrder.indexOf(a.name);
      const bi = resourceOrder.indexOf(b.name);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [resources]);

  const dayBase = useMemo(() => new Date(`${date}T00:00:00.000Z`).getTime(), [date]);
  const dayStart = useMemo(() => dayBase + (openH * 60 + openM) * 60 * 1000, [dayBase, openH, openM]);
  const dayEnd = useMemo(() => dayBase + (closeH * 60 + closeM) * 60 * 1000, [dayBase, closeH, closeM]);

  const timeRows = useMemo(() => {
    const rows: { label: string; t: number }[] = [];
    for (let t = dayStart; t < dayEnd; t += STEP_MIN * 60 * 1000) {
      rows.push({
        label: new Date(t).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }),
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
      setMsg(e.message || "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }

  async function loadWeekSummary(currentDate: string) {
    try {
      const monday = startOfWeekISO(currentDate);
      const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
      const results = await Promise.all(
        dates.map(async (d) => {
          const r = await fetch(`/api/admin/day?date=${encodeURIComponent(d)}`);
          const j = await r.json();
          const dayBookings: Booking[] = j.bookings ?? [];
          const totalCents = dayBookings.reduce(
            (sum, b) => sum + (b.paid_amount_cents ?? b.total_amount_cents ?? 0),
            0
          );
          return {
            date: d,
            label: italianWeekdayShort(d),
            bookingsCount: dayBookings.length,
            paidCount: dayBookings.filter((b) => !!b.paid_at).length,
            unpaidCount: dayBookings.filter((b) => !b.paid_at).length,
            totalCents,
          } as WeekDaySummary;
        })
      );
      setWeekSummary(results);
    } catch {
      setWeekSummary([]);
    }
  }

  useEffect(() => {
    load();
    loadWeekSummary(date);
  }, [date]);

  const items = useMemo(() => {
    const out: Array<
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
          sport: "CALCETTO" | "TENNIS" | null;
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
      const paid = !!b.paid_at;
      const note = (b.payment_note || "").toUpperCase();
      const sport = note.includes("TENNIS")
        ? "TENNIS"
        : note.includes("CALCETTO")
        ? "CALCETTO"
        : null;

      out.push({
        type: "BOOKING",
        id: b.id,
        resource_id: b.resource_id,
        start: new Date(b.start_ts).getTime(),
        end: new Date(b.end_ts).getTime(),
        title: b.user_name || "Prenotazione",
        subtitle: `${hhmm(b.start_ts)}-${hhmm(b.end_ts)} • ${b.user_phone ?? ""}`,
        badge: paid ? "Pagata" : "Da pagare",
        booking: b,
        sport,
      });
    }

    for (const bl of blocks) {
      out.push({
        type: "BLOCK",
        id: bl.id,
        resource_id: bl.resource_id,
        start: new Date(bl.start_ts).getTime(),
        end: new Date(bl.end_ts).getTime(),
        title: "Bloccato",
        subtitle: `${hhmm(bl.start_ts)}-${hhmm(bl.end_ts)}${bl.note ? ` • ${bl.note}` : ""}`,
        badge: "Blocco",
        block: bl,
      });
    }

    return out;
  }, [bookings, blocks]);

  const itemsByRes = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const r of orderedResources) map.set(r.id, []);
    for (const it of items) {
      const arr = map.get(it.resource_id) ?? [];
      arr.push(it);
      map.set(it.resource_id, arr);
    }
    for (const [, arr] of map.entries()) arr.sort((a, b) => a.start - b.start);
    return map;
  }, [orderedResources, items]);

  function topPx(t: number) {
    const diffMin = (t - dayStart) / (60 * 1000);
    return (diffMin / STEP_MIN) * rowH;
  }

  function heightPx(s: number, e: number) {
    const diffMin = (e - s) / (60 * 1000);
    return (diffMin / STEP_MIN) * rowH;
  }

  const [newOpen, setNewOpen] = useState(false);
  const [newResourceId, setNewResourceId] = useState("");
  const [newStartISO, setNewStartISO] = useState("");
  const [newMinutes, setNewMinutes] = useState(60);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newErr, setNewErr] = useState("");
  const [newSport, setNewSport] = useState<"CALCETTO" | "TENNIS">("CALCETTO");

  function openNewSlot(resourceId: string, startT: number) {
    setNewResourceId(resourceId);
    setNewStartISO(new Date(startT).toISOString());
    setNewMinutes(60);
    setNewName("");
    setNewPhone("");
    setNewErr("");
    setNewSport("CALCETTO");
    setNewOpen(true);
  }

  async function submitNewBooking() {
    setNewErr("");
    try {
      const endISO = new Date(
        new Date(newStartISO).getTime() + newMinutes * 60 * 1000
      ).toISOString();

      const r = await fetch("/api/admin/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: newResourceId,
          startISO: newStartISO,
          endISO,
          minutes: newMinutes,
          userName: newName,
          userPhone: newPhone,
          payMode: "BAR",
          sport: newSport,
          // NOTE: per salvare davvero lo sport/prezzo lato backend
          // servono modifiche anche alla route create-booking.
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore creazione prenotazione");

      setNewOpen(false);
      await load();
    } catch (e: any) {
      setNewErr(e.message || "Errore creazione prenotazione");
    }
  }

  async function createBlock() {
    setNewErr("");
    try {
      const reason = prompt("Motivo blocco campo (es. Allenamento, Manutenzione, Evento)");
      if (!reason) return;

      const endISO = new Date(
        new Date(newStartISO).getTime() + newMinutes * 60 * 1000
      ).toISOString();

      const r = await fetch("/api/admin/create-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setNewErr(e.message || "Errore creazione blocco");
    }
  }

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD">("CASH");
  const [paymentNote, setPaymentNote] = useState("");
  const [updateTotalAlso, setUpdateTotalAlso] = useState(true);
  const [detailErr, setDetailErr] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveBookingState, setMoveBookingState] = useState<Booking | null>(null);
  const [moveResource, setMoveResource] = useState("");
  const [moveTime, setMoveTime] = useState("");
  const [moveErr, setMoveErr] = useState("");

  function openDetail(b: Booking) {
    setDetailBooking(b);
    const baseCents = b.paid_amount_cents ?? b.total_amount_cents ?? null;
    setPayAmount(
      baseCents != null
        ? String((baseCents / 100).toFixed(2)).replace(".", ",")
        : ""
    );
    setPayMethod("CASH");
    setPaymentNote(b.payment_note ?? "");
    setUpdateTotalAlso(true);
    setDetailErr("");
    setDetailOpen(true);
  }

  function openMove(b: Booking) {
    setMoveBookingState(b);
    setMoveResource(b.resource_id);
    setMoveTime(b.start_ts);
    setMoveErr("");
    setMoveOpen(true);
  }

  async function confirmMove() {
    if (!moveBookingState) return;

    try {
      const duration =
        new Date(moveBookingState.end_ts).getTime() -
        new Date(moveBookingState.start_ts).getTime();

      const startISO = new Date(moveTime).toISOString();
      const endISO = new Date(new Date(moveTime).getTime() + duration).toISOString();

      const r = await fetch("/api/admin/move-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: moveBookingState.id,
          resourceId: moveResource,
          startISO,
          endISO,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore spostamento");

      setMoveOpen(false);
      await load();
    } catch (e: any) {
      setMoveErr(e.message || "Errore spostamento");
    }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: detailBooking.id,
          paidAmountCents: cents,
          paidMethod: payMethod,
          paymentNote,
          updateTotalAlso: updateTotalAlso,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore pagamento");

      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setDetailErr(e.message || "Errore pagamento");
    }
  }

  async function cancelBooking() {
    if (!detailBooking) return;

    const reason = prompt("Motivo disdetta (opzionale):") ?? "";

    try {
      const r = await fetch("/api/admin/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: detailBooking.id,
          reason: reason,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore disdetta");

      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setDetailErr(e.message || "Errore disdetta");
    }
  }

  const [blockDetailOpen, setBlockDetailOpen] = useState(false);
  const [detailBlock, setDetailBlock] = useState<Block | null>(null);
  const [blockErr, setBlockErr] = useState("");

  function openBlockDetail(bl: Block) {
    setDetailBlock(bl);
    setBlockErr("");
    setBlockDetailOpen(true);
  }

  async function deleteBlock() {
    if (!detailBlock) return;

    try {
      const r = await fetch("/api/admin/delete-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId: detailBlock.id,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore eliminazione blocco");

      setBlockDetailOpen(false);
      await load();
    } catch (e: any) {
      setBlockErr(e.message || "Errore eliminazione blocco");
    }
  }

  const [draggingBookingId, setDraggingBookingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [didMove, setDidMove] = useState(false);

  useEffect(() => {
    function stopDrag() {
      setDraggingBookingId(null);
      setDragOverKey(null);
    }
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, []);

  async function moveBooking(bookingId: string, resourceId: string, startT: number) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const durationMs =
      new Date(booking.end_ts).getTime() - new Date(booking.start_ts).getTime();

    const startISO = new Date(startT).toISOString();
    const endISO = new Date(startT + durationMs).toISOString();

    try {
      const r = await fetch("/api/admin/move-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          resourceId,
          startISO,
          endISO,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore spostamento prenotazione");

      setDidMove(true);
      await load();
    } catch (e: any) {
      setMsg(e.message || "Errore spostamento prenotazione");
    } finally {
      setDraggingBookingId(null);
      setDragOverKey(null);
      setTimeout(() => setDidMove(false), 150);
    }
  }

  const nowLineTop = useMemo(() => {
    const now = Date.now();
    if (now < dayStart || now > dayEnd) return null;
    return topPx(now);
  }, [dayStart, dayEnd]);

  const minWidth = timeColW + orderedResources.length * colW;

  function handleTouchStartPinch(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchStartDistance.current = Math.hypot(dx, dy);
    pinchStartZoom.current = zoom;
  }

  function handleTouchMovePinch(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 2 || pinchStartDistance.current == null) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const currentDistance = Math.hypot(dx, dy);
    const ratio = currentDistance / pinchStartDistance.current;
    const next = clamp(pinchStartZoom.current * ratio, 0.8, 1.5);
    setZoom(Number(next.toFixed(2)));
  }

  function handleTouchEndPinch() {
    pinchStartDistance.current = null;
  }

  const selectedNewResource = resources.find((r) => r.id === newResourceId);

  return (
    <div style={{ padding: 12, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1700, margin: "0 auto" }}>
        <img src="/logo.png" style={{ height: 64, marginBottom: 12 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 900, marginRight: 10 }}>Calendario</h1>

          <label>
            <div style={{ fontWeight: 800, fontSize: 11, opacity: 0.7 }}>Data</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "white",
              }}
            />
          </label>

          <button
            onClick={() => setViewMode("day")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: viewMode === "day" ? "#111" : "white",
              color: viewMode === "day" ? "white" : "#111",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Giorno
          </button>

          <button
            onClick={() => setViewMode("week")}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: viewMode === "week" ? "#111" : "white",
              color: viewMode === "week" ? "white" : "#111",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Settimana
          </button>

          <button
            onClick={() => setZoom((z) => Number(clamp(z - 0.1, 0.8, 1.5).toFixed(2)))}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "white",
              fontWeight: 900,
            }}
          >
            -
          </button>

          <div style={{ fontSize: 12, fontWeight: 800, minWidth: 52, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </div>

          <button
            onClick={() => setZoom((z) => Number(clamp(z + 0.1, 0.8, 1.5).toFixed(2)))}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "white",
              fontWeight: 900,
            }}
          >
            +
          </button>

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

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "#e5e7eb", fontWeight: 800, fontSize: 13 }}>
              ✅ Prenotato
            </span>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "#d9f5d9", fontWeight: 800, fontSize: 13 }}>
              💶 Pagata
            </span>
            <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ffe8cc", fontWeight: 800, fontSize: 13 }}>
              ⛔ Blocco
            </span>
          </div>
        </div>

        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 11 }}>
          Orari: {String(openH).padStart(2, "0")}:{String(openM).padStart(2, "0")} - {String(closeH).padStart(2, "0")}:{String(closeM).padStart(2, "0")} (step 30 min). • Tieni premuto su una prenotazione e trascinala su un altro slot. • Pinch sul calendario per zoom.
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

        {viewMode === "week" ? (
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {weekSummary.map((d) => (
              <button
                key={d.date}
                onClick={() => {
                  setDate(d.date);
                  setViewMode("day");
                }}
                style={{
                  textAlign: "left",
                  background: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900 }}>{d.label}</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>Prenotazioni: <b>{d.bookingsCount}</b></div>
                <div style={{ marginTop: 4, fontSize: 13 }}>Pagate: <b>{d.paidCount}</b></div>
                <div style={{ marginTop: 4, fontSize: 13 }}>Da pagare: <b>{d.unpaidCount}</b></div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 900 }}>
                  Incassato: {eurFromCents(d.totalCents)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div
            onTouchStart={handleTouchStartPinch}
            onTouchMove={handleTouchMovePinch}
            onTouchEnd={handleTouchEndPinch}
            style={{
              marginTop: 14,
              border: "1px solid #d1d5db",
              borderRadius: 16,
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x pan-y",
              background: "white",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `${timeColW}px repeat(${orderedResources.length}, ${colW}px)`,
                position: "sticky",
                top: 0,
                zIndex: 5,
                background: "#e5e7eb",
                borderBottom: "1px solid #cbd5e1",
                minWidth: minWidth,
              }}
            >
              <div style={{ padding: 10, fontWeight: 900, borderRight: "1px solid #94a3b8" }} />
              {orderedResources.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: 10,
                    fontWeight: 900,
                    borderRight: "1px solid #94a3b8",
                    whiteSpace: "nowrap",
                    fontSize: 14,
                  }}
                >
                  {r.name}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `${timeColW}px 1fr`, minWidth: minWidth }}>
              <div style={{ borderRight: "3px solid #cbd5e1", background: "#94a3b8" }}>
                {timeRows.map((t, i) => {
                  const minutes = new Date(t.t).getMinutes();
                  const isFullHour = minutes === 0;
                  const hourBand = Math.floor(i / 2) % 2 === 0;

                  return (
                    <div
                      key={i}
                      style={{
                        height: rowH,
                        padding: "12px 6px",
                        fontSize: 11,
                        fontWeight: isFullHour ? 900 : 700,
                        color: isFullHour ? "#111827" : "#4b5563",
                        background: hourBand ? "#ffffff" : "#eef2f7",
                        borderBottom: isFullHour ? "2px solid #cbd5e1" : "1px solid #e5e7eb",
                      }}
                    >
                      {t.label}
                    </div>
                  );
                })}
              </div>

              <div style={{ position: "relative" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${orderedResources.length}, ${colW}px)` }}>
                  {orderedResources.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        position: "relative",
                        height: gridH,
                        borderRight: "1px solid #94a3b8",
                        background: "#f9fafb",
                      }}
                    >
                      {timeRows.map((tr, idx) => {
                        const slotKey = `${r.id}-${tr.t}`;
                        const isDragOver = dragOverKey === slotKey;
                        const minutes = new Date(tr.t).getMinutes();
                        const isFullHour = minutes === 0;
                        const hourBand = Math.floor(idx / 2) % 2 === 0;

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (!draggingBookingId) openNewSlot(r.id, tr.t);
                            }}
                            onPointerEnter={() => {
                              if (!draggingBookingId) return;
                              setDragOverKey(slotKey);
                            }}
                            onPointerUp={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!draggingBookingId) return;
                              void moveBooking(draggingBookingId, r.id, tr.t);
                            }}
                            style={{
                              height: rowH,
                              borderBottom: isFullHour ? "2px solid #cbd5e1" : "1px solid #e5e7eb",
                              cursor: draggingBookingId ? "grabbing" : "pointer",
                              position: "relative",
                              zIndex: 1,
                              background: isDragOver ? "#dbeafe" : hourBand ? "#ffffff" : "#eef2f7",
                              outline: isDragOver ? "2px dashed #1e90ff" : "none",
                              outlineOffset: -2,
                            }}
                            title="Clicca per inserire prenotazione o bloccare il campo"
                          />
                        );
                      })}

                      {(itemsByRes.get(r.id) ?? []).map((it: any) => {
                        const top = clamp(topPx(it.start), 0, gridH);
                        const h = clamp(heightPx(it.start, it.end), 28, gridH - top);
                        const isBlock = it.type === "BLOCK";
                        const paid = it.type === "BOOKING" ? !!it.booking?.paid_at : false;

                        let bookingBg = "#e5e7eb";
                        let bookingBorder = "#cfd4dc";
                        if (isBlock) {
                          bookingBg = "#ffe8cc";
                          bookingBorder = "#f1c27d";
                        } else if (paid) {
                          bookingBg = "#d9f5d9";
                          bookingBorder = "#9ad19a";
                        } else if (r.name === "Tendone" && it.sport === "TENNIS") {
                          bookingBg = "#dbeafe";
                          bookingBorder = "#93c5fd";
                        } else if (r.name === "Tendone" && it.sport === "CALCETTO") {
                          bookingBg = "#fde68a";
                          bookingBorder = "#fbbf24";
                        }

                        return (
                          <div
                            key={it.id}
                            onPointerDown={(e) => {
                              if (it.type !== "BOOKING") return;
                              e.preventDefault();
                              e.stopPropagation();
                              setDraggingBookingId(it.booking.id);
                              setDragOverKey(null);
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              if (didMove) return;

                              if (it.type === "BOOKING") openDetail(it.booking);
                              if (it.type === "BLOCK") openBlockDetail(it.block);
                            }}
                            title={`${it.title}\n${it.subtitle}`}
                            style={{
                              position: "absolute",
                              left: 8,
                              right: 8,
                              top: top + 2,
                              height: h - 4,
                              borderRadius: 12,
                              background: bookingBg,
                              border: `1px solid ${bookingBorder}`,
                              padding: 8,
                              boxSizing: "border-box",
                              overflow: "hidden",
                              cursor: it.type === "BOOKING" ? "grab" : "pointer",
                              zIndex: 20,
                              pointerEvents: "auto",
                              opacity: draggingBookingId === it.id ? 0.55 : 1,
                              touchAction: "none",
                              userSelect: "none",
                              WebkitUserSelect: "none",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 6,
                                alignItems: "flex-start",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 950,
                                  fontSize: 12,
                                  lineHeight: 1.1,
                                  whiteSpace: "normal",
                                  wordBreak: "break-word",
                                  flex: 1,
                                  marginRight: 4,
                                }}
                              >
                                {it.title}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  flexShrink: 0,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 950,
                                    padding: "3px 6px",
                                    borderRadius: 999,
                                    background: isBlock ? "#fff3df" : paid ? "#ecffec" : "#f6f6f6",
                                    border: "1px solid rgba(0,0,0,0.08)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {it.badge}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (it.type === "BOOKING") openDetail(it.booking);
                                    if (it.type === "BLOCK") openBlockDetail(it.block);
                                  }}
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 900,
                                    padding: "3px 6px",
                                    borderRadius: 8,
                                    border: "1px solid #ccc",
                                    background: "white",
                                    cursor: "pointer",
                                  }}
                                >
                                  Apri
                                </button>
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 10,
                                fontWeight: 800,
                                opacity: 0.9,
                                lineHeight: 1.15,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {it.subtitle}
                              {it.sport ? ` • ${it.sport}` : ""}
                            </div>

                            {it.type === "BOOKING" && it.booking?.total_amount_cents != null && (
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 10,
                                  fontWeight: 950,
                                  pointerEvents: "none",
                                  lineHeight: 1.15,
                                  whiteSpace: "normal",
                                  wordBreak: "break-word",
                                }}
                              >
                                Totale: {eurFromCents(it.booking.total_amount_cents)}
                                {it.booking?.paid_at ? (
                                  <>
                                    {" "}• Incassato:{" "}
                                    {eurFromCents(
                                      it.booking.paid_amount_cents ??
                                        it.booking.total_amount_cents ??
                                        null
                                    )}
                                  </>
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
        )}

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
                    <option value={60}>1 ora</option>
                    <option value={90}>1 ora e 30</option>
                    <option value={120}>2 ore</option>
                    <option value={180}>3 ore</option>
                    <option value={240}>4 ore</option>
                    <option value={300}>5 ore</option>
                    <option value={360}>6 ore</option>
                    <option value={420}>7 ore</option>
                    <option value={480}>8 ore</option>
                    <option value={540}>9 ore</option>
                    <option value={600}>10 ore</option>
                  </select>
                </label>

                {selectedNewResource?.name === "Tendone" && (
                  <label>
                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Sport (solo Tendone)</div>
                    <select
                      value={newSport}
                      onChange={(e) => setNewSport(e.target.value as "CALCETTO" | "TENNIS")}
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      <option value="CALCETTO">Calcetto - 50 €/ora</option>
                      <option value="TENNIS">Tennis - 15 €/ora</option>
                    </select>
                  </label>
                )}

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

                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Stima prezzo:{" "}
                  {selectedNewResource
                    ? eurFromCents(pricePreview(selectedNewResource.name, newSport, newMinutes))
                    : "-"}
                </div>

                {selectedNewResource?.name === "Tendone" && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Nota: per salvare davvero sport e prezzo Tendone nel database servono anche modifiche alle route backend.
                  </div>
                )}

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

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 6,
                  }}
                >
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

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
                <div><b>Orario:</b> {hhmm(detailBooking.start_ts)}-{hhmm(detailBooking.end_ts)} • {date}</div>
                <div><b>Totale:</b> {eurFromCents(detailBooking.total_amount_cents ?? null)}</div>
                <div><b>Stato pagamento:</b> {detailBooking.paid_at ? "Pagata" : "Da pagare"}</div>
                {detailBooking.payment_note ? <div><b>Nota:</b> {detailBooking.payment_note}</div> : null}
              </div>

              <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Segna pagato</div>

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
                      onChange={(e) => setPayMethod(e.target.value as "CASH" | "CARD")}
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

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => openMove(detailBooking)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #ddd",
                        background: "#eef2ff",
                        fontWeight: 950,
                      }}
                    >
                      Sposta
                    </button>

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
                  Tip: “Ricevuta” apre la pagina stampabile. Poi fai Stampa → Salva PDF.
                </div>
              </div>
            </div>
          </div>
        )}

        {moveOpen && moveBookingState && (
          <div
            onClick={() => setMoveOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: 16,
                padding: 20,
                width: 420,
                maxWidth: "100%",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                Sposta prenotazione
              </div>

              <div style={{ marginTop: 10 }}>
                <b>{moveBookingState.user_name}</b>
              </div>

              <div style={{ marginTop: 10 }}>
                Campo
                <select
                  value={moveResource}
                  onChange={(e) => setMoveResource(e.target.value)}
                  style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 10, border: "1px solid #ddd" }}
                >
                  {orderedResources.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 10 }}>
                Orario
                <input
                  type="datetime-local"
                  value={moveTime.slice(0, 16)}
                  onChange={(e) => setMoveTime(e.target.value)}
                  style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </div>

              {moveErr && (
                <div style={{ color: "red", marginTop: 10 }}>
                  {moveErr}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setMoveOpen(false)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "white",
                    fontWeight: 900,
                  }}
                >
                  Annulla
                </button>

                <button
                  onClick={confirmMove}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: "none",
                    background: "#111",
                    color: "white",
                    fontWeight: 900,
                  }}
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}

        {blockDetailOpen && detailBlock && (
          <div
            onClick={() => setBlockDetailOpen(false)}
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
                width: 500,
                maxWidth: "100%",
                background: "white",
                borderRadius: 16,
                border: "1px solid #eee",
                padding: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 950 }}>Blocco campo</div>

              <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13 }}>
                <div><b>Orario:</b> {hhmm(detailBlock.start_ts)}-{hhmm(detailBlock.end_ts)}</div>
                <div><b>Motivo:</b> {detailBlock.note || "-"}</div>
              </div>

              {blockErr && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 12,
                    background: "#fff3f3",
                    border: "1px solid #ffd2d2",
                  }}
                >
                  {blockErr}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                <button
                  onClick={() => setBlockDetailOpen(false)}
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
                  onClick={deleteBlock}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #ffb3b3",
                    background: "#fff5f5",
                    fontWeight: 950,
                  }}
                >
                  Elimina blocco
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


