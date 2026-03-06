import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD (opzionale)
  const resourceId = url.searchParams.get("resourceId"); // opzionale

  let q = supabase
    .from("bookings")
    .select("id, resource_id, user_name, user_phone, start_ts, end_ts, status, pay_mode, created_at")
    .order("start_ts", { ascending: true })
    .limit(500);

  if (resourceId) q = q.eq("resource_id", resourceId);

  if (date) {
    // filtra su quel giorno
    const start = new Date(`${date}T00:00:00.000Z`).toISOString();
    const endDate = new Date(`${date}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const end = endDate.toISOString();
    q = q.gte("start_ts", start).lt("start_ts", end);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data ?? [] });
}