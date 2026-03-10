import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const start = date + "T00:00:00";
    const end = date + "T23:59:59";

    const resourcesRes = await supabase
      .from("resources")
      .select("id,name,is_active,is_public")
      .order("name", { ascending: true });

    if (resourcesRes.error) {
      throw resourcesRes.error;
    }

    const bookingsRes = await supabase
      .from("bookings")
      .select("*")
      .gte("start_ts", start)
      .lt("start_ts", end)
      .order("start_ts", { ascending: true });

    if (bookingsRes.error) {
      throw bookingsRes.error;
    }

    const blocksRes = await supabase
      .from("admin_blocks")
      .select("*")
      .gte("start_ts", start)
      .lt("start_ts", end)
      .order("start_ts", { ascending: true });

    if (blocksRes.error) {
      throw blocksRes.error;
    }

    return NextResponse.json({
      resources: resourcesRes.data ?? [],
      bookings: bookingsRes.data ?? [],
      blocks: blocksRes.data ?? [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "server error" },
      { status: 500 }
    );
  }
}