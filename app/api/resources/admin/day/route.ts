import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "missing date" }, { status: 400 });
  }

  const startHour = 5;
  const endHour = 23;
  const step = 30;

  const slots: Array<{
    time: string;
    date: string;
    booking: null;
  }> = [];

  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += step) {
      const hour = String(h).padStart(2, "0");
      const minute = String(m).padStart(2, "0");
      const time = ${hour}:${minute};

      slots.push({
        time,
        date,
        booking: null,
      });
    }
  }

  return NextResponse.json({ slots });
}