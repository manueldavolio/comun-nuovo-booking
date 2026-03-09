"use client";

import { useState } from "react";

export default function CalendarioAdmin() {

  const [modal, setModal] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  function openModal() {
    setModal(true);
  }

  function closeModal() {
    setModal(false);
  }

  async function salvaPrenotazione() {
    alert("Prenotazione salvata");
    setModal(false);
  }

  async function bloccaCampo() {
    alert("Campo bloccato");
    setModal(false);
  }

  return (
    <div style={{ padding: 20 }}>

      <h1 style={{ fontSize: 28, fontWeight: 900 }}>
        Calendario
      </h1>

      <div style={{ marginTop: 20 }}>
        <button onClick={openModal}>
          Clicca slot
        </button>
      </div>

      {modal && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 460,
              maxWidth: "100%",
              background: "white",
              borderRadius: 16,
              border: "1px solid #eee",
              padding: 16
            }}
          >

            <div style={{ fontSize: 18, fontWeight: 950 }}>
              Nuova prenotazione (manuale)
            </div>

            <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
              Orario: 18:00 • Data: 2026-03-09
            </div>

            <div style={{ marginTop: 16 }}>

              <label>Durata</label>

              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  marginTop: 6
                }}
              >
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>

            </div>

            <div style={{ marginTop: 12 }}>
              <label>Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  marginTop: 6
                }}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Telefono</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  marginTop: 6
                }}
              />
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10
              }}
            >

              <button onClick={closeModal}>
                Chiudi
              </button>

              <button
                onClick={salvaPrenotazione}
                style={{
                  background: "#111",
                  color: "white",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontWeight: 800
                }}
              >
                Salva prenotazione
              </button>

              <button
                onClick={bloccaCampo}
                style={{
                  background: "#e53935",
                  color: "white",
                  borderRadius: 10,
                  padding: "10px 16px",
                  fontWeight: 800
                }}
              >
                Blocca campo
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
