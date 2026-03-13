"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

export default function RicevutaPage() {
  const params = useParams()
  const id = params?.id as string

  const [booking, setBooking] = useState<any>(null)

  useEffect(() => {
    if (!id) return

    fetch(`/api/admin/get-booking?id=${id}`)
      .then(res => res.json())
      .then(data => {
        setBooking(data.booking)
      })
  }, [id])

  if (!booking) return <div style={{padding:40}}>Carico...</div>

  const start = new Date(booking.start_ts).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})
  const end = new Date(booking.end_ts).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})
  const data = new Date(booking.start_ts).toLocaleDateString("it-IT")

  return (
    <div style={{padding:40}}>
      <h1>Ricevuta</h1>

      <p><b>Cliente:</b> {booking.user_name}</p>
      <p><b>Telefono:</b> {booking.user_phone}</p>
      <p><b>Data:</b> {data}</p>
      <p><b>Orario:</b> {start} - {end}</p>
      <p><b>Importo:</b> € {(booking.total_amount_cents/100).toFixed(2)}</p>

      <button onClick={()=>window.print()}>
        Stampa / Salva PDF
      </button>
    </div>
  )
}
