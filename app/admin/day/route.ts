import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD

  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const { data: resources, error: rErr } = await supabase
    .from("resources")
    .select("id,name,is_public,is_active")
    .eq("is_active", true)
    .order("name");

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select("id,resource_id,user_name,user_phone,start_ts,end_ts,status,pay_mode")
    .in("status", ["PENDING_PAYMENT", "CONFIRMED"])
    .lt("start_ts", endISO)
    .gt("end_ts", startISO);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const { data: blocks, error: blErr } = await supabase
    .from("admin_blocks")
    .select("id,resource_id,start_ts,end_ts,note")
    .lt("start_ts", endISO)
    .gt("end_ts", startISO);

  if (blErr) return NextResponse.json({ error: blErr.message }, { status: 500 });

  return NextResponse.json({
    date,
    resources: resources ?? [],
    bookings: bookings ?? [],
    blocks: blocks ?? [],
  });
}