import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  title: string;
  resourceId: string;
  weekday: number; // 1=lun ... 7=dom
  startTime: string; // "20:00"
  endTime: string;   // "22:00"
  startDate: string; // "2026-03-01"
  endDate: string;   // "2026-06-30"
  userName: string;
  userPhone: string;
  priceCents: number; // prezzo fisso per ogni data
};

function parseHHMM(s: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  if (mm % 30 !== 0) return null;

  return { hh, mm };
}

// JS locale: getDay() -> 0 dom .. 6 sab
// Noi: weekday 1..7 (lun..dom)
function weekdayToJSDay(weekday: number) {
  if (weekday === 7) return 0;
  return weekday; // 1..6 ok
}

function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (
    !body?.title ||
    !body?.resourceId ||
    !body?.weekday ||
    !body?.startTime ||
    !body?.endTime ||
    !body?.startDate ||
    !body?.endDate ||
    !body?.userName ||
    !body?.userPhone ||
    !Number.isFinite(body.priceCents) ||
    body.priceCents <= 0
  ) {
    return NextResponse.json(
      { error: "Dati mancanti/non validi" },
      { status: 400 }
    );
  }

  if (body.weekday < 1 || body.weekday > 7) {
    return NextResponse.json(
      { error: "weekday deve essere 1..7 (lun..dom)" },
      { status: 400 }
    );
  }

  const st = parseHHMM(body.startTime);
  const et = parseHHMM(body.endTime);

  if (!st || !et) {
    return NextResponse.json(
      { error: "Orario non valido (HH:MM multipli di 30)" },
      { status: 400 }
    );
  }

  const startDate = new Date(body.startDate + "T00:00:00");
  const endDate = new Date(body.endDate + "T00:00:00");

  if (!(startDate <= endDate)) {
    return NextResponse.json(
      { error: "startDate > endDate" },
      { status: 400 }
    );
  }

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

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  const targetDay = weekdayToJSDay(body.weekday);
  let d = new Date(startDate);

  while (d.getDay() !== targetDay) {
    d = addDaysLocal(d, 1);
  }

  const conflicts: string[] = [];
  let created = 0;

  while (d <= endDate) {
    const start = new Date(d);
    start.setHours(st.hh, st.mm, 0, 0);

    const end = new Date(d);
    end.setHours(et.hh, et.mm, 0, 0);

    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: "endTime deve essere dopo startTime (stesso giorno)" },
        { status: 400 }
      );
    }

    const row = {
      resource_id: body.resourceId,
      user_name: body.userName,
      user_phone: body.userPhone,
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
      status: "CONFIRMED",
      pay_mode: "SUBSCRIPTION",
      total_amount_cents: body.priceCents,
      deposit_amount_cents: 0,
      currency: "eur",
      subscription_id: sub.id,
    };

    const { error } = await supabase.from("bookings").insert(row);

    if (error) conflicts.push(row.start_ts);
    else created += 1;

    d = addDaysLocal(d, 7);
  }

  return NextResponse.json({
    ok: true,
    subscriptionId: sub.id,
    created,
    conflicts,
  });
}
