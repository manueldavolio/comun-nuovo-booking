"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminLoginPage() {

  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/calendario";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login() {

    setError("");

    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    const j = await r.json();

    if (!r.ok) {
      setError(j.error || "Errore login");
      return;
    }

    window.location.href = next;
  }

  return (
    <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
      <div style={{ width: 400 }}>

        <h1 style={{ fontSize: 26, fontWeight: 900 }}>
          Login Admin
        </h1>

        <div style={{ marginTop: 10 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            style={{
              width:"100%",
              padding:10,
              borderRadius:10,
              border:"1px solid #ddd"
            }}
          />
        </div>

        {error && (
          <div style={{
            marginTop:10,
            padding:10,
            background:"#ffe5e5",
            borderRadius:10
          }}>
            {error}
          </div>
        )}

        <button
          onClick={login}
          style={{
            marginTop:15,
            padding:"10px 20px",
            background:"#111",
            color:"white",
            border:"none",
            borderRadius:10,
            fontWeight:900,
            cursor:"pointer"
          }}
        >
          Entra
        </button>

      </div>
    </div>
  );
}