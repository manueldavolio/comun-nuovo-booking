import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id,resource_id,user_name,user_phone,start_ts,end_ts,status,pay_mode,total_amount_cents,deposit_amount_cents,paid_amount_cents,paid_method,paid_at,created_at"
    )
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}