"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

function LoginInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin/calendario";

  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");

    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    const j = await r.json();

    if (!r.ok) {
      setMsg(j.error || "Errore login");
      return;
    }

    window.location.href = next;
  }

  return (
    <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          marginTop: 60,
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 950 }}>Login Admin</h1>

        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
          Accesso riservato al gestore.
        </div>

        <label style={{ display: "block", marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.7 }}>
            Password
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
            }}
          />
        </label>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              background: "#fff3f3",
              border: "1px solid #ffd2d2",
            }}
          >
            {msg}
          </div>
        )}

        <button
          onClick={submit}
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "white",
            fontWeight: 950,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Entra
        </button>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Caricamento...</div>}>
      <LoginInner />
    </Suspense>
  );
}