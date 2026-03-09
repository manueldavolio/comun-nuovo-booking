import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "missing date" }, { status: 400 });
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("*")
      .eq("date", date);

    if (bookingsError) {
      return NextResponse.json(
        { error: bookingsError.message },
        { status: 500 }
      );
    }

    const startHour = 5;
    const endHour = 23;
    const step = 30;

    const slots: any[] = [];

    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += step) {
        const time = ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")};

        slots.push({
          time,
          date,
          booking: bookings?.find((b: any) => b.time === time) || null,
        });
      }
    }

    return NextResponse.json({ slots });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "server error" },
      { status: 500 }
    );
  }
}