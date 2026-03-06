import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function toDayRangeISO(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const resourceId = url.searchParams.get("resourceId");
  const date = url.searchParams.get("date");
  const minutes = Number(url.searchParams.get("minutes") || "60");

  if (!resourceId || !date || ![60, 90].includes(minutes)) {
    return NextResponse.json(
      { error: "Parametri non validi (resourceId, date, minutes)" },
      { status: 400 }
    );
  }

  const { startISO, endISO } = toDayRangeISO(date);

  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select("start_ts,end_ts,status")
    .eq("resource_id", resourceId)
    .in("status", ["PENDING_PAYMENT", "CONFIRMED"])
    .lt("start_ts", endISO)
    .gt("end_ts", startISO);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const { data: blocks, error: blErr } = await supabase
    .from("admin_blocks")
    .select("start_ts,end_ts")
    .eq("resource_id", resourceId)
    .lt("start_ts", endISO)
    .gt("end_ts", startISO);

  if (blErr) return NextResponse.json({ error: blErr.message }, { status: 500 });

  const OPEN_HOUR = 8;
  const CLOSE_HOUR = 23;

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const open = new Date(dayStart);
  open.setUTCHours(OPEN_HOUR, 0, 0, 0);

  const close = new Date(dayStart);
  close.setUTCHours(CLOSE_HOUR, 0, 0, 0);

  const stepMs = 30 * 60 * 1000;
  const durMs = minutes * 60 * 1000;

  const busy: Array<{ start: number; end: number }> = [];
  for (const b of bookings ?? []) busy.push({ start: new Date(b.start_ts).getTime(), end: new Date(b.end_ts).getTime() });
  for (const bl of blocks ?? []) busy.push({ start: new Date(bl.start_ts).getTime(), end: new Date(bl.end_ts).getTime() });

  const overlaps = (s: number, e: number) => busy.some((x) => s < x.end && e > x.start);

  const slots: Array<{ startISO: string; endISO: string }> = [];
  for (let t = open.getTime(); t + durMs <= close.getTime(); t += stepMs) {
    const s = t;
    const e = t + durMs;
    if (!overlaps(s, e)) slots.push({ startISO: new Date(s).toISOString(), endISO: new Date(e).toISOString() });
  }

  return NextResponse.json({ slots });
}