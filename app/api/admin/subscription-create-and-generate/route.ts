import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  title: string;
  resourceId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  userName: string;
  userPhone: string;
  priceCents: number;
};

function parseHHMM(s: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (mm % 30 !== 0) return null;
  return { hh, mm };
}

function weekdayToJS(weekday: number) {
  return weekday === 7 ? 0 : weekday;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const st = parseHHMM(body.startTime);
  const et = parseHHMM(body.endTime);
  if (!st || !et)
    return NextResponse.json({ error: "Orari non validi" }, { status: 400 });

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);

  const { data: sub, error: sErr } = await supabase
    .from("subscriptions")
    .insert({
      title: body.title,
      resource_id: body.resourceId,
      weekday: body.weekday,
      start_time: body.startTime,
      end_time: body.endTime,
      start_date: body.startDate,
      end_date: body.endDate,
      price_cents: body.priceCents,
      user_name: body.userName,
      user_phone: body.userPhone,
      is_active: true,
    })
    .select("id")
    .single();

  if (sErr)
    return NextResponse.json({ error: sErr.message }, { status: 500 });

  const targetDay = weekdayToJS(body.weekday);

  let d = new Date(startDate);
  while (d.getDay() !== targetDay) d = addDays(d, 1);

  let created = 0;
  const conflicts: string[] = [];

  while (d <= endDate) {
    const start = new Date(d);
    start.setHours(st.hh, st.mm, 0, 0);

    const end = new Date(d);
    end.setHours(et.hh, et.mm, 0, 0);

    const { error } = await supabase.from("bookings").insert({
      resource_id: body.resourceId,
      user_name: body.userName,
      user_phone: body.userPhone,
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
      status: "CONFIRMED",
      pay_mode: "SUBSCRIPTION",
      total_amount_cents: body.priceCents,
      currency: "eur",
      subscription_id: sub.id,
    });

    if (error) conflicts.push(start.toISOString());
    else created++;

    d = addDays(d, 7);
  }

  return NextResponse.json({ ok: true, created, conflicts });
}
