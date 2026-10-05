import { NextResponse } from "next/server";
import { buildRomeIso } from "@/lib/datetime-rome";
import {
  buildMonthlyReportWorkbook,
  reportFileName,
  workbookToBuffer,
  type MonthlyReportBooking,
} from "@/lib/monthly-report-excel";
import { supabase } from "@/lib/supabase";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthBoundsRome(year: number, month: number) {
  const startDate = `${year}-${pad2(month)}-01`;
  const startISO = buildRomeIso(startDate, "00:00");

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const endDate = `${nextYear}-${pad2(nextMonth)}-01`;
  const endISO = buildRomeIso(endDate, "00:00");

  return { startISO, endISO };
}

type BookingRow = {
  start_ts: string;
  end_ts: string;
  user_name: string | null;
  total_amount_cents: number | null;
  status: string | null;
  resources: { name: string } | { name: string }[] | null;
};

function resourceNameOf(row: BookingRow): string {
  const r = row.resources;
  if (!r) return "Sconosciuto";
  if (Array.isArray(r)) return r[0]?.name || "Sconosciuto";
  return r.name || "Sconosciuto";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      year < 2000 ||
      year > 2100
    ) {
      return NextResponse.json(
        { error: "Parametri mese/anno non validi" },
        { status: 400 }
      );
    }

    const { startISO, endISO } = monthBoundsRome(year, month);

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        start_ts,
        end_ts,
        user_name,
        total_amount_cents,
        status,
        resources ( name )
      `
      )
      .gte("start_ts", startISO)
      .lt("start_ts", endISO)
      .neq("status", "CANCELLED")
      .order("start_ts", { ascending: true })
      .limit(5000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bookings: MonthlyReportBooking[] = ((data ?? []) as BookingRow[]).map(
      (row) => ({
        start_ts: row.start_ts,
        end_ts: row.end_ts,
        user_name: row.user_name,
        total_amount_cents: row.total_amount_cents,
        resource_name: resourceNameOf(row),
      })
    );

    const wb = buildMonthlyReportWorkbook(bookings, month, year);
    const buffer = workbookToBuffer(wb);
    const filename = reportFileName(month, year);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Errore generazione report" },
      { status: 500 }
    );
  }
}
