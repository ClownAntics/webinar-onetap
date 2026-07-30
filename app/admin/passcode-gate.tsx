"use client";

import { useState } from "react";

export default function PasscodeGate() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Wrong passcode");
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          color: "#2f302f",
          width: 360,
          borderRadius: 20,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Webinar Admin</h1>
        <input
          autoFocus
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          style={{
            width: "100%",
            height: 48,
            textAlign: "center",
            letterSpacing: 3,
            borderRadius: 12,
            border: "1.5px solid #ddd",
            fontSize: 16,
          }}
        />
        {error && <div style={{ color: "#B41F24", fontSize: 13 }}>{error}</div>}
        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            height: 50,
            borderRadius: 12,
            border: "none",
            background: "#2f302f",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {busy ? "…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
