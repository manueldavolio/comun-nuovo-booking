import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const resource_id = body?.resource_id;
    const start_ts = body?.start_ts;
    const end_ts = body?.end_ts;
    const reason = body?.reason ?? null;

    if (!resource_id || !start_ts || !end_ts) {
      return NextResponse.json(
        { error: "Dati mancanti per il blocco" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("admin_blocks")
      .insert([
        {
          resource_id,
          start_ts,
          end_ts,
          note: reason,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Errore creazione blocco" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      block: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "server error" },
      { status: 500 }
    );
  }
}