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

function getSchedule() {
  return { openH: 9, openM: 0, closeH: 23, closeM: 0 };
}

function isWithinSchedule(startISO: string, endISO: string) {
  const { openH, openM, closeH, closeM } = getSchedule();
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sameDay =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCDate() === end.getUTCDate();
  if (!sameDay) return false;
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return startMinutes >= openMinutes && endMinutes <= closeMinutes && endMinutes > startMinutes;
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
  const EVENTI_NAME = "Eventi";
  const EVENTI_VIRTUAL_ID = "__eventi_virtual_ui__";
  const resourceOrder = ["Palazzetto", "Tendone", "Saletta palestra", EVENTI_NAME];

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
  const { openH, openM, closeH, closeM } = getSchedule();

  const baseTimeColW = 76;
  const baseColW = 300;
  const baseRowH = 56;

  const timeColW = Math.round(baseTimeColW * zoom);
  const colW = Math.round(baseColW * zoom);
  const rowH = Math.round(baseRowH * zoom);

  const orderedResources = useMemo(() => {
    const allowed = resources.filter((r) => resourceOrder.includes(r.name));
    const baseOrdered = resourceOrder
      .map((name) => allowed.find((r) => r.name === name))
      .filter(Boolean) as Resource[];

    const hasEventi = baseOrdered.some((r) => r.name === EVENTI_NAME);
    if (hasEventi) return baseOrdered;

    // UI fallback: mostra sempre "Eventi"; per renderlo persistente serve una resource "Eventi" nel DB.
    return [
      ...baseOrdered,
      {
        id: EVENTI_VIRTUAL_ID,
        name: EVENTI_NAME,
        is_active: true,
        is_public: false,
      },
    ];
  }, [resources]);

  const dayBase = useMemo(() => new Date(`${date}T00:00:00.000Z`).getTime(), [date]);
  const dayStart = useMemo(() => dayBase + (openH * 60 + openM) * 60 * 1000, [dayBase, openH, openM]);
  const dayEnd = useMemo(() => dayBase + (closeH * 60 + closeM) * 60 * 1000, [dayBase, closeH, closeM]);

  const timeRows = useMemo(() => {
    const rows: { label: string; t: number }[] = [];
    const startMinutes = openH * 60 + openM;
    const endMinutes = closeH * 60 + closeM;
    const startTs = dayBase + startMinutes * 60 * 1000;
    const endTs = dayBase + endMinutes * 60 * 1000;

    for (let t = startTs; t < endTs; t += STEP_MIN * 60 * 1000) {
      const d = new Date(t);
      const label = `${String(d.getUTCHours()).padStart(2, "0")}:${String(
        d.getUTCMinutes()
      ).padStart(2, "0")}`;
      rows.push({ label, t });
    }

    return rows;
  }, [dayBase, openH, openM, closeH, closeM, STEP_MIN]);

  const gridH = timeRows.length * rowH;

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`/api/admin/day?date=${encodeURIComponent(date)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Errore caricamento");
      setResources(
        (j.resources ?? []).filter(
          (x: any) => x.is_active && resourceOrder.includes(x.name)
        )
      );
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

  function isVirtualEventiResource(resourceId: string) {
    return resourceId === EVENTI_VIRTUAL_ID;
  }

  function getResourceName(resourceId: string) {
    return orderedResources.find((r) => r.id === resourceId)?.name ?? "";
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
    if (isVirtualEventiResource(newResourceId)) {
      setNewErr(
        "La colonna Eventi è visibile in UI ma non è ancora configurata nel database. Aggiungi la resource 'Eventi' lato backend per salvare gli slot."
      );
      return;
    }
    try {
      const endISO = new Date(
        new Date(newStartISO).getTime() + newMinutes * 60 * 1000
      ).toISOString();
      if (!isWithinSchedule(newStartISO, endISO)) {
        setNewErr("Orario non valido: l'ultima fascia disponibile termina alle 23:00.");
        return;
      }

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
    if (isVirtualEventiResource(newResourceId)) {
      setNewErr(
        "La colonna Eventi è visibile in UI ma non è ancora configurata nel database. Aggiungi la resource 'Eventi' lato backend per salvare blocchi/eventi."
      );
      return;
    }
    try {
      const reason = prompt("Motivo blocco campo (es. Allenamento, Manutenzione, Evento)");
      if (!reason) return;

      const endISO = new Date(
        new Date(newStartISO).getTime() + newMinutes * 60 * 1000
      ).toISOString();
      if (!isWithinSchedule(newStartISO, endISO)) {
        setNewErr("Orario non valido: i blocchi devono restare tra 09:00 e 23:00.");
        return;
      }

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
    if (isVirtualEventiResource(moveResource)) {
      setMoveErr(
        "Per spostare su Eventi serve la resource 'Eventi' nel database."
      );
      return;
    }

    try {
      const duration =
        new Date(moveBookingState.end_ts).getTime() -
        new Date(moveBookingState.start_ts).getTime();

      const startISO = new Date(moveTime).toISOString();
      const endISO = new Date(new Date(moveTime).getTime() + duration).toISOString();
      if (!isWithinSchedule(startISO, endISO)) {
        setMoveErr("Orario non valido: lo slot deve terminare entro le 23:00.");
        return;
      }

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
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [didMove, setDidMove] = useState(false);

  useEffect(() => {
    function stopDrag() {
      setDraggingBookingId(null);
      setDragOverKey(null);
      setHoveredSlotKey(null);
    }
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, []);

  async function moveBooking(bookingId: string, resourceId: string, startT: number) {
    if (isVirtualEventiResource(resourceId)) {
      setMsg("Per spostare su Eventi serve la resource 'Eventi' nel database.");
      setDraggingBookingId(null);
      setDragOverKey(null);
      return;
    }
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const durationMs =
      new Date(booking.end_ts).getTime() - new Date(booking.start_ts).getTime();

    const startISO = new Date(startT).toISOString();
    const endISO = new Date(startT + durationMs).toISOString();
    if (!isWithinSchedule(startISO, endISO)) {
      setMsg("Orario non valido: non puoi superare le 23:00.");
      setDraggingBookingId(null);
      setDragOverKey(null);
      return;
    }

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

  const minWidth = Math.max(timeColW + orderedResources.length * colW, 1480);
  const gridTemplate = `${timeColW}px repeat(${orderedResources.length}, minmax(${colW}px, 1fr))`;
  const dayPaidCents = useMemo(
    () => bookings.reduce((sum, b) => sum + (b.paid_amount_cents ?? 0), 0),
    [bookings]
  );
  const dayUnpaidCount = useMemo(
    () => bookings.filter((b) => !b.paid_at).length,
    [bookings]
  );
  const dayBlocksCount = blocks.length;

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

  const selectedNewResource = orderedResources.find((r) => r.id === newResourceId);

  const pageBg = "linear-gradient(180deg, #f7faff 0%, #ebf1fb 55%, #e7eef9 100%)";
  const panelBg = "rgba(255,255,255,0.97)";
  const borderColor = "#d2deee";
  const softShadow = "0 14px 34px rgba(15, 23, 42, 0.09)";
  const timeBandA = "#fcfdff";
  const timeBandB = "#f3f7fc";
  const eveningBandA = "#eef3fb";
  const eveningBandB = "#e4ebf7";
  const eveningStartHour = 18;

  return (
    <div
      style={{
        padding: "14px clamp(10px, 1.8vw, 26px)",
        minHeight: "100vh",
        background: pageBg,
        colorScheme: "light",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", margin: "0 auto" }}>
        <div
          style={{
            background: panelBg,
            borderRadius: 24,
            border: `1px solid ${borderColor}`,
            boxShadow: softShadow,
            padding: 18,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
              <img src="/logo.png" style={{ height: 60, width: "auto" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#4f46e5", letterSpacing: 0.2 }}>
                  ADMIN BOOKING
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 950, margin: "2px 0 0 0", color: "#0f172a" }}>
                  Calendario operativo
                </h1>
              </div>
            </div>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                fontSize: 12,
                fontWeight: 900,
                color: "#3730a3",
              }}
            >
              Fascia fissa 09:00-23:00 · step 30 minuti
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #1e3a8a 0%, #4f46e5 58%, #7c3aed 100%)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.18)",
              padding: 14,
              color: "white",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 24px rgba(79,70,229,0.24)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9, letterSpacing: 0.2 }}>
              Dashboard del giorno
            </div>
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              <div style={{ background: "rgba(255,255,255,0.14)", borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.86 }}>Prenotazioni</div>
                <div style={{ marginTop: 3, fontSize: 21, fontWeight: 950 }}>{bookings.length}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.14)", borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.86 }}>Da pagare</div>
                <div style={{ marginTop: 3, fontSize: 21, fontWeight: 950 }}>{dayUnpaidCount}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.14)", borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.86 }}>Incassato oggi</div>
                <div style={{ marginTop: 3, fontSize: 21, fontWeight: 950 }}>{eurFromCents(dayPaidCents)}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.14)", borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.86 }}>Blocchi attivi</div>
                <div style={{ marginTop: 3, fontSize: 21, fontWeight: 950 }}>{dayBlocksCount}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
              border: `1px solid ${borderColor}`,
              borderRadius: 16,
              padding: 10,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
            }}
          >
          <label style={{ minWidth: 170 }}>
            <div style={{ fontWeight: 900, fontSize: 11, opacity: 0.72, color: "#334155" }}>Data</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
              }}
            />
          </label>

            <button
              onClick={() => setViewMode("day")}
              style={{
                padding: "10px 15px",
                borderRadius: 12,
                border: viewMode === "day" ? "1px solid #4338ca" : `1px solid ${borderColor}`,
                background: viewMode === "day" ? "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)" : "white",
                color: viewMode === "day" ? "white" : "#0f172a",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: viewMode === "day" ? "0 6px 16px rgba(79,70,229,0.28)" : "none",
              }}
            >
              Giorno
            </button>

            <button
              onClick={() => setViewMode("week")}
              style={{
                padding: "10px 15px",
                borderRadius: 12,
                border: viewMode === "week" ? "1px solid #4338ca" : `1px solid ${borderColor}`,
                background: viewMode === "week" ? "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)" : "white",
                color: viewMode === "week" ? "white" : "#0f172a",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: viewMode === "week" ? "0 6px 16px rgba(79,70,229,0.28)" : "none",
              }}
            >
              Settimana
            </button>

            <button
              onClick={() => setZoom((z) => Number(clamp(z - 0.1, 0.8, 1.5).toFixed(2)))}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                background: "#ffffff",
                color: "#334155",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              -
            </button>

            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                minWidth: 62,
                textAlign: "center",
                color: "#334155",
                padding: "8px 10px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              {Math.round(zoom * 100)}%
            </div>

            <button
              onClick={() => setZoom((z) => Number(clamp(z + 0.1, 0.8, 1.5).toFixed(2)))}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                background: "#ffffff",
                color: "#334155",
                fontWeight: 900,
                cursor: "pointer",
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
                border: "1px solid #1d4ed8",
                background: loading
                  ? "linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)"
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "white",
                fontWeight: 900,
                cursor: loading ? "wait" : "pointer",
                boxShadow: "0 6px 16px rgba(37,99,235,0.28)",
              }}
            >
              {loading ? "Aggiorno..." : "Aggiorna"}
            </button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#e2e8f0",
                border: "1px solid #cbd5e1",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              ✅ Prenotato
            </span>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#dcfce7",
                border: "1px solid #86efac",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              💶 Pagata
            </span>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#ffedd5",
                border: "1px solid #fdba74",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              ⛔ Blocco
            </span>
            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#ede9fe",
                border: "1px solid #c4b5fd",
                fontWeight: 800,
                fontSize: 12,
                color: "#5b21b6",
              }}
            >
              🎉 Eventi
            </span>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              opacity: 0.82,
              fontSize: 11,
              color: "#334155",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "8px 10px",
            }}
          >
            Orari: {String(openH).padStart(2, "0")}:{String(openM).padStart(2, "0")} - {String(closeH).padStart(2, "0")}:{String(closeM).padStart(2, "0")} (step 30 min). • Tieni premuto su una prenotazione e trascinala su un altro slot. • Pinch sul calendario per zoom.
          </div>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "linear-gradient(180deg, #fff7f7 0%, #fff1f2 100%)",
              border: "1px solid #fda4af",
              color: "#7f1d1d",
              fontWeight: 700,
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
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 18,
                  padding: 16,
                  boxShadow: "0 10px 22px rgba(15,23,42,0.08)",
                  cursor: "pointer",
                  transition: "transform 0.16s ease, box-shadow 0.16s ease",
                }}
              >
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)",
                    marginBottom: 10,
                  }}
                />
                <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>{d.label}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>Prenotazioni: <b>{d.bookingsCount}</b></div>
                <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>Pagate: <b>{d.paidCount}</b></div>
                <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>Da pagare: <b>{d.unpaidCount}</b></div>
                <div style={{ marginTop: 10, fontSize: 14, fontWeight: 900, color: "#1e3a8a" }}>
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
              border: `1px solid ${borderColor}`,
                borderRadius: 20,
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x pan-y",
                background: "linear-gradient(180deg, #f8fbff 0%, #f2f7ff 100%)",
                boxShadow: "0 14px 30px rgba(15,23,42,0.1)",
              backgroundImage:
                "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0) 48%)",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                position: "sticky",
                top: 0,
                zIndex: 5,
                background: "linear-gradient(180deg, #edf4ff 0%, #d9e6fb 100%)",
                borderBottom: "1px solid #b9c9e3",
                minWidth: minWidth,
                width: "100%",
              }}
            >
              <div
                style={{
                  padding: "12px 10px",
                  fontWeight: 900,
                  borderRight: "2px solid #acbfdc",
                  background: "rgba(226,236,250,0.9)",
                  color: "#334155",
                  fontSize: 12,
                  letterSpacing: 0.2,
                }}
              >
                ORARIO
              </div>
              {orderedResources.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: "10px 12px",
                    fontWeight: 950,
                    borderRight: "2px solid #acbfdc",
                    whiteSpace: "nowrap",
                    fontSize: 15.5,
                    color: r.name === EVENTI_NAME ? "#5b21b6" : "#0f172a",
                    background:
                      r.name === EVENTI_NAME
                        ? "linear-gradient(180deg, #f3e8ff 0%, #ede9fe 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(240,246,255,0.92) 100%)",
                    display: "flex",
                    alignItems: "center",
                    borderTop: "1px solid rgba(255,255,255,0.55)",
                  }}
                >
                  {r.name}
                </div>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                  minWidth: minWidth,
                  width: "100%",
                }}
              >
              <div
                style={{
                  borderRight: "3px solid #b6c6df",
                  background: "linear-gradient(180deg, #dce7f8 0%, #d0dff5 100%)",
                }}
              >
                {timeRows.map((t, i) => {
                  const minutes = new Date(t.t).getMinutes();
                  const hour = new Date(t.t).getUTCHours();
                  const isFullHour = minutes === 0;
                  const hourBand = Math.floor(i / 2) % 2 === 0;
                  const isEvening = hour >= eveningStartHour;

                  return (
                    <div
                      key={i}
                      style={{
                        height: rowH,
                        padding: "14px 8px",
                        fontSize: 11.5,
                        fontWeight: isFullHour ? 900 : 700,
                        color: isFullHour ? "#0f172a" : "#334155",
                        background: isEvening
                          ? hourBand
                            ? "#dbe4f3"
                            : "#d1dced"
                          : hourBand
                          ? "#edf3fc"
                          : "#e5edf8",
                        borderBottom: isFullHour ? "2px solid #c8d5ea" : "1px solid #d6e0ee",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {t.label}
                    </div>
                  );
                })}
              </div>

                {orderedResources.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      position: "relative",
                      height: gridH,
                      borderRight: "2px solid #c7d4e9",
                      background:
                        r.name === EVENTI_NAME
                          ? "linear-gradient(180deg, #faf5ff 0%, #f5f3ff 100%)"
                          : "#f7fafe",
                    }}
                  >
                      {timeRows.map((tr, idx) => {
                        const slotKey = `${r.id}-${tr.t}`;
                        const isDragOver = dragOverKey === slotKey;
                        const isHovered = hoveredSlotKey === slotKey;
                        const minutes = new Date(tr.t).getMinutes();
                        const hour = new Date(tr.t).getUTCHours();
                        const isFullHour = minutes === 0;
                        const hourBand = Math.floor(idx / 2) % 2 === 0;
                        const isEvening = hour >= eveningStartHour;
                        const baseSlotBg =
                          r.name === EVENTI_NAME
                            ? hourBand
                              ? "#f8f0ff"
                              : "#f2e9ff"
                            : isEvening
                            ? hourBand
                              ? eveningBandA
                              : eveningBandB
                            : hourBand
                            ? timeBandA
                            : timeBandB;

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (!draggingBookingId) openNewSlot(r.id, tr.t);
                            }}
                            onPointerEnter={() => {
                              if (!draggingBookingId) setHoveredSlotKey(slotKey);
                              if (!draggingBookingId) return;
                              setDragOverKey(slotKey);
                            }}
                            onPointerLeave={() => {
                              if (hoveredSlotKey === slotKey) setHoveredSlotKey(null);
                              if (!draggingBookingId) return;
                              if (dragOverKey === slotKey) setDragOverKey(null);
                            }}
                            onPointerUp={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!draggingBookingId) return;
                              void moveBooking(draggingBookingId, r.id, tr.t);
                            }}
                            style={{
                              height: rowH,
                              borderBottom: isFullHour ? "2px solid #cfdbec" : "1px solid #dfe7f2",
                              cursor: draggingBookingId ? "grabbing" : "pointer",
                              position: "relative",
                              zIndex: 1,
                              background: isDragOver
                                ? "#dbeafe"
                                : isHovered
                                ? "linear-gradient(180deg, #eef6ff 0%, #dbeafe 100%)"
                                : baseSlotBg,
                              outline: isDragOver ? "2px dashed #2563eb" : "none",
                              outlineOffset: -2,
                              transition:
                                "background 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                              boxShadow:
                                isHovered && !draggingBookingId
                                  ? "inset 0 0 0 1px rgba(59,130,246,0.22)"
                                  : "none",
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
                        const resourceName = getResourceName(it.resource_id);
                        const isEventResource = resourceName === EVENTI_NAME;
                        const isHoveredItem = hoveredItemId === it.id;

                        let bookingBg = "#e2e8f0";
                        let bookingBorder = "#cbd5e1";
                        let badgeBg = "#f8fafc";
                        let badgeColor = "#0f172a";
                        if (isBlock) {
                          bookingBg = "#fee2e2";
                          bookingBorder = "#fca5a5";
                          badgeBg = "#fff1f2";
                          badgeColor = "#9f1239";
                        } else if (isEventResource) {
                          bookingBg = "#ede9fe";
                          bookingBorder = "#c4b5fd";
                          badgeBg = "#f5f3ff";
                          badgeColor = "#5b21b6";
                        } else if (resourceName === "Tendone" && it.sport === "CALCETTO") {
                          bookingBg = "#dbeafe";
                          bookingBorder = "#93c5fd";
                          badgeBg = "#eff6ff";
                          badgeColor = "#1d4ed8";
                        } else if (resourceName === "Tendone" && it.sport === "TENNIS") {
                          bookingBg = "#dcfce7";
                          bookingBorder = "#86efac";
                          badgeBg = "#f0fdf4";
                          badgeColor = "#166534";
                        } else if (paid) {
                          bookingBg = "#dcfce7";
                          bookingBorder = "#86efac";
                          badgeBg = "#f0fdf4";
                          badgeColor = "#166534";
                        } else {
                          bookingBg = "#ffedd5";
                          bookingBorder = "#fdba74";
                          badgeBg = "#fff7ed";
                          badgeColor = "#9a3412";
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
                            onPointerEnter={() => setHoveredItemId(it.id)}
                            onPointerLeave={() => {
                              if (hoveredItemId === it.id) setHoveredItemId(null);
                            }}
                            title={`${it.title}\n${it.subtitle}`}
                            style={{
                              position: "absolute",
                              left: 6,
                              right: 6,
                              top: top + 3,
                              height: h - 6,
                              borderRadius: 14,
                              background: bookingBg,
                              border: `2px solid ${bookingBorder}`,
                              padding: "8px 9px",
                              boxSizing: "border-box",
                              overflow: "hidden",
                              cursor: it.type === "BOOKING" ? "grab" : "pointer",
                              zIndex: 20,
                              pointerEvents: "auto",
                              opacity: draggingBookingId === it.id ? 0.55 : 1,
                              touchAction: "none",
                              userSelect: "none",
                              WebkitUserSelect: "none",
                              boxShadow: isHoveredItem
                                ? "0 12px 24px rgba(15,23,42,0.18)"
                                : "0 6px 14px rgba(15,23,42,0.12)",
                              transform: isHoveredItem ? "scale(1.012)" : "scale(1)",
                              transition:
                                "transform 180ms ease, box-shadow 180ms ease, background 180ms ease",
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
                                    background: badgeBg,
                                    color: badgeColor,
                                    border: "1px solid rgba(15,23,42,0.15)",
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
                                    border: "1px solid #cbd5e1",
                                    background: "white",
                                    cursor: "pointer",
                                    color: "#334155",
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
                              {isEventResource ? " • Evento" : ""}
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
                    left: timeColW,
                    right: 0,
                    top: nowLineTop,
                    height: 2,
                    background: "#1e90ff",
                    opacity: 0.8,
                    boxShadow: "0 0 0 1px rgba(30,144,255,0.15)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {nowLineTop !== null && (
                <div
                  style={{
                    position: "absolute",
                    top: nowLineTop - 9,
                    left: timeColW + 8,
                    background: "#1d4ed8",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 900,
                    padding: "2px 7px",
                    borderRadius: 999,
                    pointerEvents: "none",
                    boxShadow: "0 6px 16px rgba(29,78,216,0.35)",
                  }}
                >
                  Ora
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {newOpen && (
          <div
            onClick={() => setNewOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
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
                background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                borderRadius: 20,
                border: `1px solid ${borderColor}`,
                boxShadow: "0 20px 48px rgba(15,23,42,0.22)",
                padding: 18,
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 950, color: "#0f172a" }}>Nuovo slot</div>
              <div style={{ marginTop: 6, opacity: 0.82, fontSize: 13, color: "#334155" }}>
                Orario: {hhmm(newStartISO)} • Data: {date}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 900,
                  color: selectedNewResource?.name === EVENTI_NAME ? "#6d28d9" : "#1d4ed8",
                }}
              >
                Risorsa: {selectedNewResource?.name ?? "-"}
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <label>
                  <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Durata</div>
                  <select
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      background: "white",
                    }}
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
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: `1px solid ${borderColor}`,
                        background: "white",
                      }}
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
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      background: "white",
                    }}
                  />
                </label>

                <label>
                  <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Telefono</div>
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      background: "white",
                    }}
                  />
                </label>

                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    background: "#f8fbff",
                    border: `1px solid ${borderColor}`,
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0f172a",
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
                      background: "#fff7f7",
                      border: "1px solid #ffc7c7",
                      color: "#7f1d1d",
                      fontWeight: 700,
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
                      border: "1px solid #fdba74",
                      background: "linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)",
                      fontWeight: 900,
                      cursor: "pointer",
                      color: "#7c2d12",
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
                        border: `1px solid ${borderColor}`,
                        background: "white",
                        fontWeight: 900,
                        color: "#334155",
                      }}
                    >
                      Chiudi
                    </button>

                    <button
                      onClick={submitNewBooking}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #1d4ed8",
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "white",
                        fontWeight: 900,
                        boxShadow: "0 6px 16px rgba(37,99,235,0.25)",
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
              background: "rgba(15,23,42,0.45)",
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
                background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                borderRadius: 20,
                border: `1px solid ${borderColor}`,
                boxShadow: "0 20px 48px rgba(15,23,42,0.22)",
                padding: 18,
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 950, color: "#0f172a" }}>Prenotazione</div>

              <div style={{ marginTop: 6, display: "grid", gap: 4, fontSize: 13, opacity: 0.9, color: "#334155" }}>
                <div><b>Nome:</b> {detailBooking.user_name}</div>
                <div><b>Telefono:</b> {detailBooking.user_phone}</div>
                <div><b>Orario:</b> {hhmm(detailBooking.start_ts)}-{hhmm(detailBooking.end_ts)} • {date}</div>
                <div><b>Risorsa:</b> {getResourceName(detailBooking.resource_id) || "-"}</div>
                <div><b>Totale:</b> {eurFromCents(detailBooking.total_amount_cents ?? null)}</div>
                <div><b>Stato pagamento:</b> {detailBooking.paid_at ? "Pagata" : "Da pagare"}</div>
                {detailBooking.payment_note ? <div><b>Nota:</b> {detailBooking.payment_note}</div> : null}
              </div>

              <div style={{ marginTop: 12, borderTop: `1px solid ${borderColor}`, paddingTop: 12 }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Segna pagato</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <label>
                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Importo (€)</div>
                    <input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: `1px solid ${borderColor}`,
                        background: "white",
                      }}
                      placeholder="es. 60,00"
                    />
                  </label>

                  <label>
                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.7 }}>Metodo</div>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as "CASH" | "CARD")}
                      style={{
                        width: "100%",
                        padding: 10,
                        borderRadius: 10,
                        border: `1px solid ${borderColor}`,
                        background: "white",
                      }}
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
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${borderColor}`,
                      marginTop: 6,
                      background: "white",
                    }}
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
                      background: "#fff7f7",
                      border: "1px solid #ffc7c7",
                      color: "#7f1d1d",
                      fontWeight: 700,
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
                      border: "1px solid #fca5a5",
                      background: "#fff1f2",
                      fontWeight: 950,
                      color: "#991b1b",
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
                        border: `1px solid ${borderColor}`,
                        background: "#eef2ff",
                        fontWeight: 950,
                        color: "#3730a3",
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
                        border: `1px solid ${borderColor}`,
                        background: "white",
                        fontWeight: 950,
                        textDecoration: "none",
                        color: "#0f172a",
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
                        border: "1px solid #1d4ed8",
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "white",
                        fontWeight: 950,
                        boxShadow: "0 6px 16px rgba(37,99,235,0.25)",
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
              background: "rgba(15,23,42,0.5)",
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
                background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                borderRadius: 20,
                border: `1px solid ${borderColor}`,
                boxShadow: "0 20px 48px rgba(15,23,42,0.22)",
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
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 4,
                    borderRadius: 10,
                    border: `1px solid ${borderColor}`,
                    background: "white",
                  }}
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
                  style={{
                    width: "100%",
                    padding: 10,
                    marginTop: 4,
                    borderRadius: 10,
                    border: `1px solid ${borderColor}`,
                    background: "white",
                  }}
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
                    border: `1px solid ${borderColor}`,
                    background: "white",
                    fontWeight: 900,
                    color: "#334155",
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
                    border: "1px solid #1d4ed8",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "white",
                    fontWeight: 900,
                    boxShadow: "0 6px 16px rgba(37,99,235,0.25)",
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
              background: "rgba(15,23,42,0.45)",
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
                background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                borderRadius: 20,
                border: `1px solid ${borderColor}`,
                boxShadow: "0 20px 48px rgba(15,23,42,0.22)",
                padding: 18,
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 950, color: "#0f172a" }}>Blocco campo</div>

              <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13, color: "#334155" }}>
                <div><b>Orario:</b> {hhmm(detailBlock.start_ts)}-{hhmm(detailBlock.end_ts)}</div>
                <div><b>Risorsa:</b> {getResourceName(detailBlock.resource_id) || "-"}</div>
                <div><b>Motivo:</b> {detailBlock.note || "-"}</div>
              </div>

              {blockErr && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 12,
                      background: "#fff7f7",
                      border: "1px solid #ffc7c7",
                      color: "#7f1d1d",
                      fontWeight: 700,
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
                    border: `1px solid ${borderColor}`,
                    background: "white",
                    fontWeight: 900,
                    color: "#334155",
                  }}
                >
                  Chiudi
                </button>

                <button
                  onClick={deleteBlock}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #fca5a5",
                    background: "#fff1f2",
                    fontWeight: 950,
                    color: "#991b1b",
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


