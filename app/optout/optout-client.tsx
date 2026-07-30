"use client";

import { useState } from "react";

export default function OptoutClient({ email }: { email: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function optOut() {
    setBusy(true);
    await fetch("/api/optout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setBusy(false);
    setDone(true);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
      }}
    >
      {done ? (
        <>
          <h1 style={{ fontWeight: 900, fontSize: 24 }}>You&apos;re opted out</h1>
          <p style={{ color: "var(--fp-text-65)" }}>
            You won&apos;t receive webinar invites anymore. Changed your mind?{" "}
            <a href="/api/optout?undo=1" style={{ color: "var(--fp-yellow)" }}>
              Undo
            </a>
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontWeight: 900, fontSize: 24 }}>Stop webinar invites?</h1>
          <p style={{ color: "var(--fp-text-65)" }}>
            {email ? <>We&apos;ll stop sending webinar invites to {email}.</> : "Confirm to stop webinar invites."}
          </p>
          <button
            onClick={optOut}
            disabled={busy || !email}
            style={{
              height: 52,
              padding: "0 28px",
              borderRadius: 12,
              border: "none",
              background: "var(--fp-yellow)",
              color: "#2f302f",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {busy ? "…" : "Stop webinar invites"}
          </button>
        </>
      )}
    </main>
  );
}
