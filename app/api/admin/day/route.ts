import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .gte("start_ts", ${date}T00:00:00)
      .lt("start_ts", ${date}T23:59:59);

    if (error) {
      throw error;
    }

    const slots = [];
    let hour = 15;
    let minute = 30;

    while (hour < 23) {
      const time = ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")};

      const booking = bookings?.find((b) =>
        b.start_ts.includes(${date}T${time})
      );

      slots.push({
        time,
        booking: booking || null,
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
