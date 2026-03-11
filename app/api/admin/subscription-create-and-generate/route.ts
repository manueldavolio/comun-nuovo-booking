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

// JS UTC: 0 dom .. 6 sab
// Noi: 1..7 (lun..dom)
function weekdayToUTCDay(weekday: number) {
  if (weekday === 7) return 0;
  return weekday;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastSundayOfMonthUTC(year: number, monthIndexZeroBased: number) {
  const d = new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)); // ultimo giorno del mese
  const day = d.getUTCDay(); // 0 domenica
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

// Restituisce offset Europe/Rome per quella data/ora locale
// +01:00 inverno, +02:00 estate
function getRomeOffsetString(datePart: string, timePart: string) {
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const marchLastSunday = lastSundayOfMonthUTC(year, 2);   // marzo
  const octoberLastSunday = lastSundayOfMonthUTC(year, 9); // ottobre

  const marchDay = marchLastSunday.getUTCDate();
  const octoberDay = octoberLastSunday.getUTCDate();

  let isDST = false;

  if (month < 3 || month > 10) {
    isDST = false;
  } else if (month > 3 && month < 10) {
    isDST = true;
  } else if (month === 3) {
    if (day > marchDay) isDST = true;
    else if (day < marchDay) isDST = false;
    else {
      // giorno cambio ora a marzo: dalle 02:00 in poi è DST
      isDST = hour >= 2;
    }
  } else if (month === 10) {
    if (day < octoberDay) isDST = true;
    else if (day > octoberDay) isDST = false;
    else {
      // giorno cambio ora a ottobre: fino alle 02:59 ancora DST
      isDST = hour < 3 || (hour === 2 && minute <= 59);
    }
  }

  return isDST ? "+02:00" : "+01:00";
}

function buildRomeIso(datePart: string, timePart: string) {
  const offset = getRomeOffsetString(datePart, timePart);
  return `${datePart}T${timePart}:00${offset}`;
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

  // Controllo semplice che fine sia dopo inizio
  if (et.hh * 60 + et.mm <= st.hh * 60 + st.mm) {
    return NextResponse.json(
      { error: "endTime deve essere dopo startTime (stesso giorno)" },
      { status: 400 }
    );
  }

  const startDate = new Date(`${body.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${body.endDate}T00:00:00.000Z`);

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

  const targetUTCDay = weekdayToUTCDay(body.weekday);
  let d = new Date(startDate);

  while (d.getUTCDay() !== targetUTCDay) {
    d = addDaysUTC(d, 1);
  }

  const conflicts: string[] = [];
  let created = 0;

  while (d <= endDate) {
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const datePart = `${yyyy}-${mm}-${dd}`;

    const startISO = buildRomeIso(datePart, body.startTime);
    const endISO = buildRomeIso(datePart, body.endTime);

    const row = {
      resource_id: body.resourceId,
      user_name: body.userName,
      user_phone: body.userPhone,
      start_ts: startISO,
      end_ts: endISO,
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

    d = addDaysUTC(d, 7);
  }

  return NextResponse.json({
    ok: true,
    subscriptionId: sub.id,
    created,
    conflicts,
  });
}
