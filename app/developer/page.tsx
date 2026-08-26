import Link from "next/link";

export const metadata = { title: "Developer guide — OneTap Webinars" };

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
        <span style={{ fontWeight: 800 }}>Developer guide</span>
        <Link href="/" style={{ color: "#FCD700", fontWeight: 700 }}>← Home</Link>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <section style={card}>
          <h2 style={h2}>Stack</h2>
          <ul>
            <li style={li}>Next.js (App Router) + TypeScript on <b>Vercel</b>.</li>
            <li style={li}>Repo: <span style={code}>github.com/ClownAntics/webinar-onetap</span>. Full build notes in <span style={code}>SETUP.md</span> / <span style={code}>README-build-v3.md</span>.</li>
            <li style={li}><b>Supabase</b> (project <span style={code}>rilhgeshkypbcckedaoh</span>) — Google auth + the <span style={code}>webinar_*</span> tables + the <span style={code}>td_order</span> sales mirror.</li>
            <li style={li}><b>Zoom</b> Server-to-Server OAuth (&quot;Webinar Data Collector&quot; app). <b>Omnisend</b> for lifecycle emails.</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Auth</h2>
          <p style={{ margin: 0 }}>
            Supabase Auth + Google, gated to allowed email domains (<span style={code}>ADMIN_ALLOWED_DOMAINS</span>, default
            clownantics.com/facepaint.com/careerlearning.com). See <span style={code}>lib/auth.ts</span> + <span style={code}>middleware.ts</span>.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>Key routes</h2>
          <ul>
            <li style={li}><span style={code}>/w/[webinarId]</span> — public one-tap page. <span style={code}>POST /api/register</span> registers via Zoom, returns the personal join_url; on failure it redirects to Zoom&apos;s native registration.</li>
            <li style={li}><span style={code}>/admin</span> — dashboard, detail (setup + status lifecycle + stats + answers), <span style={code}>/admin/trends</span> (revenue charts + CSV).</li>
            <li style={li}><span style={code}>/api/attendance-sync</span> (<span style={code}>{"{webinarId}"}</span> or <span style={code}>{"{all:true}"}</span>), <span style={code}>/api/cron</span> — attendance, Omnisend sweep/events, summary cache. Cron runs <b>daily 05:00 UTC</b> (Vercel Hobby cap) and requires <span style={code}>Authorization: Bearer CRON_SECRET</span>. <span style={code}>/api/admin/webinar/*</span> — save, status, banner upload.</li>
            <li style={li}><span style={code}>/api/visit</span> — landing-page visit beacon (conversion denominator). <span style={code}>/api/omnisend-test</span> — seed event types / probe keys. <span style={code}>/api/zoom-history</span> — Dashboard-API history scan (CRON_SECRET too; <b>dead on the current Zoom plan</b> — Dashboard API needs Business+).</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Omnisend (SPEC-omnisend-sms.md)</h2>
          <p style={{ margin: 0 }}>
            Per-brand keys (<span style={code}>OMNISEND_API_KEY_FACEPAINT</span> / <span style={code}>_CLOWNANTICS</span>; CareerLearning none — no-ops).
            Events <span style={code}>webinar registered / attended / starting</span> — ⚠️ <b>&quot;starting&quot; is gated OFF</b> (<span style={code}>STARTING_ENABLED=false</span> in the cron route; daily-only cron can&apos;t hit a T-15 window — do not build flows on it),
            rolling contact properties (<span style={code}>lastWebinarRegistered/Attended</span>, <span style={code}>webinarsAttendedCount</span>), single tag <span style={code}>webinar-audience</span>.
            Idempotency via <span style={code}>webinar_send_log</span>; registration never blocks on Omnisend — the cron sweep is the retry.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>Reporting (revenue)</h2>
          <p style={{ margin: 0 }}>
            7-day attribution: match attendee/no-show emails to <span style={code}>td_order</span> (sum <span style={code}>TotalCostCalced</span> for orders within 7 days of the webinar).
            New/Reactivated/Active segmentation. See <span style={code}>lib/reporting.ts</span>. History back to June 2024 is imported (backfill done; re-runnable via <span style={code}>scripts/backfill.mjs</span>).
            ⚠️ PostgREST caps responses at 1000 rows — paginate full-table reads with <span style={code}>fetchAllRows</span> (<span style={code}>lib/supabase.ts</span>).
            Sales lookups use the <span style={code}>webinar_orders_for_emails</span> SQL function (case-insensitive, indexed) — call it plain, never with <span style={code}>.order()/.range()</span>.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>Registration stats</h2>
          <p style={{ margin: 0 }}>
            Registration counts + by-source come from Zoom <span style={code}>GET /webinars/&#123;id&#125;/tracking_sources</span>,
            blended with the app&apos;s own reg events (Zoom can&apos;t see API registrations — no source_id).
            Needs the <span style={code}>webinar:read:list_tracking_sources</span> scope. The landing page also sets a
            1-year <span style={code}>onetap_identity</span> cookie on successful registration — read server-side when the
            URL has no <span style={code}>?e=</span>, so returning registrants one-tap from plain links.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>⚠️ Zoom scope gotchas (cost days)</h2>
          <ul>
            <li style={li}>Webinar scopes are filed under the <b>&quot;Meetings&quot;</b> product in Add Scopes — there is <b>no &quot;Webinar&quot; category</b>. If a scope looks &quot;missing,&quot; click <b>Meetings</b>.</li>
            <li style={li}>Registration needs <span style={code}>webinar:write:registrant:admin</span>; stats need <span style={code}>webinar:read:list_tracking_sources:admin</span>. After adding scopes, redeploy (the S2S token is cached ~55 min).</li>
            <li style={li}>The webinar&apos;s custom question must be <b>not required</b>, or <span style={code}>POST registrants</span> returns code 300.</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>Env vars (Vercel)</h2>
          <p style={{ margin: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, lineHeight: 1.7 }}>
            ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET / ZOOM_HOST_USER_ID<br />
            SUPABASE_URL / SUPABASE_SERVICE_KEY · SALES_SUPABASE_URL / SALES_SUPABASE_KEY<br />
            NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY · ADMIN_ALLOWED_DOMAINS<br />
            OMNISEND_API_KEY_FACEPAINT / OMNISEND_API_KEY_CLOWNANTICS · CRON_SECRET · NEXT_PUBLIC_SITE_URL
          </p>
        </section>

        <p style={{ fontSize: 13, color: "#888" }}>
          Non-technical guide: <Link href="/help">How to use</Link>.
        </p>
      </div>
    </main>
  );
}
