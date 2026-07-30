import { cookies } from "next/headers";
import PasscodeGate from "./passcode-gate";
import { listWebinars, type ZoomWebinar } from "@/lib/zoom";

export const dynamic = "force-dynamic";

async function loadWebinars(): Promise<{ webinars: ZoomWebinar[]; error?: string }> {
  try {
    const [upcoming, past] = await Promise.all([
      listWebinars("upcoming"),
      listWebinars("past"),
    ]);
    return { webinars: [...upcoming, ...past] };
  } catch (err) {
    return { webinars: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function AdminPage() {
  const jar = await cookies();
  if (jar.get("admin_ok")?.value !== "1") {
    return <PasscodeGate />;
  }

  const { webinars, error } = await loadWebinars();

  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header
        style={{
          background: "#2f302f",
          color: "#fff",
          padding: "14px 20px",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        Webinar Admin
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Webinars</h2>
          <a
            href="/admin/trends"
            style={{
              background: "#2f302f",
              color: "#FCD700",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            📈 Trends &amp; revenue
          </a>
        </div>
        <p style={{ color: "#666", fontSize: 13 }}>
          Pulled from Zoom ({`service@facepaint.com`}) — create webinars there as usual.
        </p>

        {error && (
          <div
            style={{
              background: "#FBE3E4",
              color: "#B41F24",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              margin: "12px 0",
            }}
          >
            Zoom not reachable yet ({error}). Wire ZOOM_* env vars to populate this list.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {webinars.map((w) => (
            <a
              key={w.id}
              href={`/admin/${w.id}`}
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #eee",
                padding: 16,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>{w.topic}</div>
              <div style={{ color: "#888", fontSize: 12.5 }}>
                {new Date(w.start_time).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
              </div>
            </a>
          ))}
          {webinars.length === 0 && !error && (
            <div style={{ color: "#888", fontSize: 14 }}>No webinars found.</div>
          )}
        </div>

        <p style={{ marginTop: 24, fontSize: 12.5, color: "#999" }}>
          Detail view, status lifecycle, revenue &amp; trends (§4a) — see README-build-v3.md. Scaffolded next.
        </p>
      </div>
    </main>
  );
}
