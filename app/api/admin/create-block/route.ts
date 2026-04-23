import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CENTER_TIME_ZONE = "Europe/Rome";

function getCenterDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: CENTER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function isInsideDailyWindow(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const startParts = getCenterDateParts(start);
  const endParts = getCenterDateParts(end);

  const sameDay =
    startParts.year === endParts.year &&
    startParts.month === endParts.month &&
    startParts.day === endParts.day;
  if (!sameDay) return false;

  const startMinutes = Number(startParts.hour) * 60 + Number(startParts.minute);
  const endMinutes = Number(endParts.hour) * 60 + Number(endParts.minute);
  return startMinutes >= 9 * 60 && endMinutes <= 23 * 60 && endMinutes > startMinutes;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const resource_id = body?.resource_id;
    const start_ts = body?.start_ts;
    const end_ts = body?.end_ts;
    const reason = body?.reason ?? null;

    if (!resource_id || !start_ts || !end_ts) {
      return NextResponse.json(
        { error: "Dati mancanti per il blocco" },
        { status: 400 }
      );
    }
    if (!isInsideDailyWindow(start_ts, end_ts)) {
      return NextResponse.json(
        { error: "Orario non valido: i blocchi devono restare tra 09:00 e 23:00." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("admin_blocks")
      .insert([
        {
          resource_id,
          start_ts,
          end_ts,
          note: reason,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Errore creazione blocco" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      block: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "server error" },
      { status: 500 }
    );
  }
}