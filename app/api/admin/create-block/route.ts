import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();

  const { resource_id, start_ts, end_ts, reason } = body;

  const { error } = await supabase
    .from("blocks")
    .insert({
      resource_id,
      start_ts,
      end_ts,
      reason
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}