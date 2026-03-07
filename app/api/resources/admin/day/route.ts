import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const date = searchParams.get("date")

  if (!date) {
    return NextResponse.json({ error: "missing date" }, { status: 400 })
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("date", date)

  const startHour = 5
  const endHour = 23
  const step = 30

  const slots: any[] = []

  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += step) {

      const time =
        ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}

      slots.push({
        time,
        date,
        booking: bookings?.find(b => b.time === time) || null
      })
    }
  }

  // ---------------------------
  // BLOCCO ALLENAMENTI
  // ---------------------------

  const trainingBlocks = [
    { day: 1, start: "19:00", end: "21:00" }, // lunedì
    { day: 3, start: "19:00", end: "21:00" }  // mercoledì
  ]

  const dayOfWeek = new Date(date).getDay()

  const filteredSlots = slots.filter(slot => {

    const blocked = trainingBlocks.find(b =>
      b.day === dayOfWeek &&
      slot.time >= b.start &&
      slot.time < b.end
    )

    return !blocked
  })

  return NextResponse.json({ slots: filteredSlots })
}