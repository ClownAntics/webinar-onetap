"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { AuthReason } from "@/lib/auth";

export default function LoginGate({ reason, email }: { reason: AuthReason; email?: string | null }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = !!url && !!anon;

  async function signIn() {
    if (!configured) return;
    const supabase = createBrowserClient(url!, anon!);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", color: "#2f302f", width: 380, borderRadius: 20, padding: 32, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center" }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Webinar Admin</h1>

        {reason === "not_allowed" && (
          <div style={{ background: "#FBE3E4", color: "#B41F24", borderRadius: 10, padding: 12, fontSize: 13 }}>
            {email ? `${email} isn't an authorized employee account.` : "Not an authorized account."} Sign in with your
            company Google account.
          </div>
        )}
        {reason === "unconfigured" && (
          <div style={{ background: "#FFF3C4", color: "#8a6d00", borderRadius: 10, padding: 12, fontSize: 13 }}>
            Auth isn&apos;t configured yet. Set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY.
          </div>
        )}

        <button
          onClick={signIn}
          disabled={!configured}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 12,
            border: "1.5px solid #ddd",
            background: "#fff",
            color: "#2f302f",
            fontWeight: 700,
            fontSize: 15,
            cursor: configured ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <GoogleG /> Sign in with Google
        </button>

        {reason === "not_allowed" && (
          <form action="/auth/signout" method="post" style={{ width: "100%" }}>
            <button type="submit" style={{ background: "none", border: "none", color: "#888", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>
              Sign out
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.9z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.4-.7-2.9-.7-4.6s.3-3.2.7-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.4 0-11.8-3.8-13.7-9.9l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}
