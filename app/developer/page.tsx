import Link from "next/link";

export const metadata = { title: "Developer notes — FacePaint Webinars" };

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
};
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 800, marginTop: 0 };
const li: React.CSSProperties = { marginBottom: 6, lineHeight: 1.5 };
const code: React.CSSProperties = { fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, background: "#f0eee9", padding: "1px 5px", borderRadius: 4 };

export default function DeveloperPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header style={{ background: "#2f302f", color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800 }}>Developer instructions</span>
        <Link href="/" style={{ color: "#FCD700", fontWeight: 700 }}>← Home</Link>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <section style={card}>
          <h2 style={h2}>Stack</h2>
          <ul>
            <li style={li}>Next.js (App Router) + TypeScript on <b>Vercel</b>.</li>
            <li style={li}>Repo: <span style={code}>github.com/bcabot202/webinar-onetap</span>. Full build notes in <span style={code}>SETUP.md</span> / <span style={code}>README-build-v3.md</span>.</li>
            <li style={li}><b>Supabase</b> (project <span style={code}>rilhgeshkypbcckedaoh</span>) — Google auth + the <span style={code}>webinar_*</span> tables + the <span style={code}>td_order</span> sales mirror.</li>
            <li style={li}><b>Zoom</b> Server-to-Server OAuth (&quot;Webinar Data Collector&quot; app). <b>Omnisend</b> for lifecycle emails.</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Auth</h2>
          <p style={{ margin: 0 }}>
            Supabase Auth + Google, gated to allowed email domains (<span style={code}>ADMIN_ALLOWED_DOMAINS</span>, default
            clownantics.com/facepaint.com). See <span style={code}>lib/auth.ts</span> + <span style={code}>middleware.ts</span>.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>Key routes</h2>
          <ul>
            <li style={li}><span style={code}>/w/[webinarId]</span> — public one-tap page. <span style={code}>POST /api/register</span> registers via Zoom, returns the personal join_url; on failure it redirects to Zoom&apos;s native registration.</li>
            <li style={li}><span style={code}>/admin</span> — dashboard, detail (setup + status lifecycle + stats + answers), <span style={code}>/admin/trends</span> (revenue charts + CSV).</li>
            <li style={li}><span style={code}>/api/attendance-sync</span>, <span style={code}>/api/cron</span> — attendance + scheduled sends. <span style={code}>/api/admin/webinar/*</span> — save, status, banner upload.</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Reporting (revenue)</h2>
          <p style={{ margin: 0 }}>
            7-day attribution: match attendee/no-show emails to <span style={code}>td_order</span> (sum <span style={code}>TotalCostCalced</span> for orders within 7 days of the webinar).
            New/Reactivated/Active segmentation. See <span style={code}>lib/reporting.ts</span>. Backfill history with <span style={code}>scripts/backfill.mjs</span>.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>⚠️ Zoom scope gotcha (cost days)</h2>
          <p style={{ margin: 0 }}>
            The webinar registrant write scope <span style={code}>webinar:write:registrant:admin</span> is filed under the
            <b> &quot;Meetings&quot;</b> product in Add Scopes — there is <b>no separate &quot;Webinar&quot; category</b>. If it looks
            &quot;missing,&quot; click the <b>Meetings</b> product. Also: the webinar&apos;s custom question must be <b>not required</b>,
            or <span style={code}>POST registrants</span> returns code 300.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>Env vars (Vercel)</h2>
          <p style={{ margin: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, lineHeight: 1.7 }}>
            ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET / ZOOM_HOST_USER_ID<br />
            SUPABASE_URL / SUPABASE_SERVICE_KEY · SALES_SUPABASE_URL / SALES_SUPABASE_KEY<br />
            NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY · ADMIN_ALLOWED_DOMAINS<br />
            OMNISEND_API_KEY (pending) · NEXT_PUBLIC_SITE_URL
          </p>
        </section>

        <p style={{ fontSize: 13, color: "#888" }}>
          Non-technical guide: <Link href="/help">How to use</Link>.
        </p>
      </div>
    </main>
  );
}
