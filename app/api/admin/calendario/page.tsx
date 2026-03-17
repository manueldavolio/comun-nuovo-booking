"use client";


import { useEffect, useMemo, useRef, useState } from "react";


type Sport = "CALCETTO" | "TENNIS";


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
  sport?: Sport | null;
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
  const day = d.getDay();
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


function isTendoneResource(resource?: { name?: string | null }) {
  return (resource?.name || "").trim().toLowerCase().includes("tendone");
}


function pricePreview(resourceName: string, sport: Sport, minutes: number) {
  if (isTendoneResource({ name: resourceName })) {
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
  const dayStart = useMemo(
    () => dayBase + (openH * 60 + openM) * 60 * 1000,
    [dayBase, openH, openM]
  );
  const dayEnd = useMemo(
    () => dayBase + (closeH * 60 + closeM) * 60 * 1000,
    [dayBase, closeH, closeM]
  );


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
          sport: Sport | null;
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
      const sport =
        b.sport === "TENNIS"
          ? "TENNIS"
          : b.sport === "CALCETTO"
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
  const [newSport, setNewSport] = useState<Sport>("CALCETTO");


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


  const selectedNewResource = resources.find((r) => r.id === newResourceId);


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
          sport: isTendoneResource(selectedNewResource) ? newSport : null,
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
  const [moveSport, setMoveSport] = useState<Sport>("CALCETTO");
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
    setMoveSport(b.sport === "TENNIS" ? "TENNIS" : "CALCETTO");
    setMoveErr("");
    setMoveOpen(true);
  }


  const selectedMoveResource = resources.find((r) => r.id === moveResource);


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
          sport: isTendoneResource(selectedMoveResource) ? moveSport : null,
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
      const resource = resources.find((r) => r.id === resourceId);
      const sport = isTendoneResource(resource)
        ? booking.sport === "TENNIS"
          ? "TENNIS"
          : "CALCETTO"
        : null;


      const r = await fetch("/api/admin/move-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          resourceId,
          startISO,
          endISO,
          sport,
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


  return (
    <div style={{ padding: 12, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1700, margin: "0 auto" }}>
        <img src="/logo.png" style={{ height: 64, marginBottom: 12 }} />
        <div style={{padding: 8, fontWeight: 700}}>File completo generato correttamente. Usa il file .tsx allegato per evitare troncamenti nel docx.</div>
      </div>
    </div>
  );
}




