import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Missing date" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const start = date + "T00:00:00";
    const end = date + "T23:59:59";

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .gte("start_ts", start)
      .lt("start_ts", end);

    if (error) {
      throw error;
    }

    const slots: Array<{ time: string; booking: any | null }> = [];

    let hour = 15;
    let minute = 30;

    while (hour < 23) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");
      const time = hh + ":" + mm;

      const booking =
        bookings?.find((b: any) =>
          String(b.start_ts).includes(date + "T" + time)
        ) || null;

      slots.push({
        time,
        booking,
      });

      minute += 30;

      if (minute === 60) {
        minute = 0;
        hour++;
      }
    }

    return NextResponse.json({ slots });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "server error" },
      { status: 500 }
    );
  }
}