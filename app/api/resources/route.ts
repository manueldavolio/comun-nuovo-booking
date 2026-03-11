import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("resources")
    .select("id, name, is_public, is_active")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message, resources: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({
    resources: data ?? [],
  });
}
