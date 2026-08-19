import Link from "next/link";
import LoginGate from "../login-gate";
import { getEmployee } from "@/lib/auth";
import StatusPill from "../status-pill";
import SetupPanel from "./setup-panel";
import CopyButton from "./copy-button";
import { appSupabase, fetchAllRows } from "@/lib/supabase";
import { getWebinar, getRegistrantQuestions, getTrackingSources, type TrackingSource } from "@/lib/zoom";
import { cleanWebinarTitle } from "@/lib/format";
import { computeOneWebinarMetrics } from "@/lib/reporting";
import { STATUS_META, autoAdjust } from "@/lib/status";
import { env } from "@/lib/env";
import { BRAND_LABELS } from "@/lib/brands";
import type { WebinarConfig, WebinarMetrics, WebinarStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
// Revenue block reads full attendance history for lifetime segmentation.
export const maxDuration = 60;

interface RegEvent {
  email: string;
  source: string | null;
  question_answer: string | null;
  status: string | null;
  ts: string;
}
interface AttRow {
  email: string;
  attended: boolean;
}

interface Detail {
  config: WebinarConfig | null;
  visits: number;
  topic: string;
  rawTopic: string | null;
  startTime: string | null;
  zoomAgenda?: string;
  zoomQuestion?: string;
  zoomBanner?: string;
  trackingSources: TrackingSource[];
  regEvents: RegEvent[];
  attendance: AttRow[];
  dbError?: string;
}

async function loadDetail(webinarId: string): Promise<Detail> {
  let config: WebinarConfig | null = null;
  let regEvents: RegEvent[] = [];
  let attendance: AttRow[] = [];
  let visits = 0;
  let dbError: string | undefined;

  try {
    const sb = appSupabase();
    const [cfg, re, att] = await Promise.all([
      sb.from("webinar_config").select("*").eq("webinar_id", webinarId).maybeSingle<WebinarConfig>(),
      fetchAllRows<RegEvent>((from, to) =>
        sb.from("webinar_reg_events").select("email, source, question_answer, status, ts").eq("webinar_id", webinarId).order("id").range(from, to)
      ),
      fetchAllRows<AttRow>((from, to) =>
        sb.from("webinar_attendance").select("email, attended").eq("webinar_id", webinarId).order("id").range(from, to)
      ),
    ]);
    config = cfg.data ?? null;
    regEvents = re;
    attendance = att;
    // Landing-page visits (denominator for conversion). Table arrives with
    // migration 0005 — degrade to 0 until then.
    try {
      const { count } = await sb
        .from("webinar_visits")
        .select("id", { count: "exact", head: true })
        .eq("webinar_id", webinarId);
      visits = count ?? 0;
    } catch {
      visits = 0;
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const [zw, questions, trackingSources] = await Promise.all([
    getWebinar(webinarId).catch(() => null),
    getRegistrantQuestions(webinarId).catch(() => [] as string[]),
    getTrackingSources(webinarId).catch(() => [] as TrackingSource[]),
  ]);
  // Zoom's API doesn't expose the registration-page banner image (branding is
  // web-UI only, and the page's og:image is just the FP logo), so we don't
  // auto-fill the banner — it's uploaded via Supabase Storage instead.
  const zoomBanner = undefined;

  return {
    config,
    visits,
    topic: config?.display_title ?? config?.zoom_topic ?? zw?.topic ?? webinarId,
    rawTopic: zw?.topic ?? config?.zoom_topic ?? null,
    startTime: config?.start_time ?? zw?.start_time ?? null,
    zoomAgenda: zw?.agenda || undefined,
    zoomQuestion: questions[0] || undefined,
    zoomBanner,
    trackingSources,
    regEvents,
    attendance,
    dbError,
  };
}

export default async function WebinarDetail({
  params,
}: {
  params: Promise<{ webinarId: string }>;
}) {
  const { webinarId } = await params;
  const auth = await getEmployee();
  if (auth.reason !== "ok") return <LoginGate reason={auth.reason} email={auth.email} />;

  const d = await loadDetail(webinarId);

  // Registration stats from Zoom's tracking sources — the accurate numbers
  // (the app DB only sees people who registered through the app).
  const zoomVisitors = d.trackingSources.reduce((s, x) => s + x.visitor_count, 0);
  const registered = d.trackingSources.reduce((s, x) => s + x.registration_count, 0);
  // Show all channels (incl. SMS at 0), highest registrations first.
  const sources = [...d.trackingSources].sort((a, b) => b.registration_count - a.registration_count);

  const answers = d.regEvents
    .filter((r) => r.question_answer && r.question_answer.trim())
    .map((r) => ({ email: r.email, answer: r.question_answer!.trim() }));

  // One-tap (app) registrations — Zoom's tracking counts can't see these.
  const oneTapUnique = new Set(
    d.regEvents.filter((r) => r.status === "success" && r.source !== "backfill").map((r) => r.email.toLowerCase())
  ).size;

  const attended = d.attendance.filter((a) => a.attended).length;
  const hasAttendance = d.attendance.length > 0;
  const showRate = registered > 0 ? Math.round((attended / registered) * 100) : 0;

  const endPassed = d.startTime ? Date.now() > new Date(d.startTime).getTime() : false;
  const storedStatus: WebinarStatus = d.config?.status ?? "NEEDS_SETUP";
  const status = autoAdjust(storedStatus, { answersCount: answers.length, endPassed });

  // Revenue block (§4a) — past webinars with attendance + sales configured.
  let metrics: WebinarMetrics | null = null;
  let metricsError: string | undefined;
  if (hasAttendance) {
    try {
      metrics = await computeOneWebinarMetrics(webinarId);
    } catch (err) {
      metricsError = err instanceof Error ? err.message : String(err);
    }
  }

  // Merge-tag link WITHOUT ?src= — the Setup panel appends the chosen channel
  // so it can't be left on a stale value.
  const omnisendLink = `${env.siteUrl}/w/${webinarId}?e=[[contact.email]]&fn=[[contact.firstName]]`;

  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header style={{ background: "#2f302f", color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Link href="/admin" style={{ color: "#FCD700", fontWeight: 700 }}>← All webinars</Link>
        <span style={{ fontWeight: 800, fontSize: 17 }}>{d.topic}</span>
        <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 700 }}>
          {BRAND_LABELS[d.config?.brand ?? "facepaint"]}
        </span>
        <StatusPill status={status} />
        {d.startTime && (
          <span style={{ color: "#bbb", fontSize: 12.5 }}>
            {new Date(d.startTime).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
          </span>
        )}
      </header>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: 24 }}>
        <div style={{ background: "#FFF6D6", color: "#8a6d00", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 16 }}>
          → {STATUS_META[status].hint}
        </div>

        {d.dbError && (
          <div style={{ background: "#FBE3E4", color: "#B41F24", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>
            App Supabase not reachable ({d.dbError}). Setup + stats need SUPABASE_URL / SUPABASE_SERVICE_KEY.
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          {/* Setup (left) */}
          <div style={{ flex: "1 1 380px", minWidth: 320 }}>
            <SetupPanel
              webinarId={webinarId}
              brand={d.config?.brand ?? "facepaint"}
              baseLink={`${env.siteUrl}/w/${webinarId}`}
              display_title={d.config?.display_title ?? (cleanWebinarTitle(d.rawTopic) || d.topic)}
              question_text={d.config?.question_text ?? d.zoomQuestion ?? ""}
              agenda={d.config?.agenda ?? d.zoomAgenda ?? ""}
              banner_url={d.config?.banner_url ?? d.zoomBanner ?? ""}
              status={status}
              omnisendLink={omnisendLink}
            />
          </div>

          {/* Stats + Answers (right) */}
          <div style={{ flex: "1 1 380px", minWidth: 320, display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={card}>
              <div style={cardTitle}>Stats</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatTile label="Registered" value={registered + oneTapUnique} />
                {oneTapUnique > 0 && <StatTile label="⚡ One-tap" value={oneTapUnique} />}
                {d.visits > 0 && <StatTile label="Page visits" value={d.visits} />}
                {d.visits > 0 && oneTapUnique > 0 && (
                  <StatTile label="Conversion" value={`${Math.round((oneTapUnique / d.visits) * 100)}%`} tone="green" />
                )}
                {zoomVisitors > 0 && <StatTile label="Zoom visitors" value={zoomVisitors} />}
                {hasAttendance && <StatTile label="Attended" value={attended} tone="green" />}
                {hasAttendance && <StatTile label="Show rate" value={`${showRate}%`} tone="green" />}
              </div>

              <TrackingSourcesBlock sources={sources} />

              {metrics && <RevenueBlock m={metrics} />}
              {metricsError && (
                <div style={{ fontSize: 12, color: "#999" }}>
                  Revenue: sales mirror not reachable ({metricsError}).
                </div>
              )}
              {!hasAttendance && (
                <div style={{ fontSize: 12.5, color: "#999" }}>
                  Attendance + revenue appear after the webinar (via attendance-sync).
                </div>
              )}
            </section>

            <section style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={cardTitle}>What customers want to see ({answers.length})</div>
                {answers.length > 0 && (
                  <CopyButton
                    text={answers.map((a) => `${a.email} — "${a.answer}"`).join("\n")}
                    label="Copy all answers"
                    bg="#fff"
                    fg="#2f302f"
                  />
                )}
              </div>
              {answers.length === 0 ? (
                <div style={{ fontSize: 13, color: "#999" }}>Answers appear here as people register.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  {answers.map((a, i) => (
                    <div key={i} style={{ background: "#F5F4F0", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
                      <span style={{ color: "#888" }}>{a.email}</span> — “{a.answer}”
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------- presentational bits ---------- */

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 20, display: "flex", flexDirection: "column", gap: 14 };
const cardTitle: React.CSSProperties = { fontWeight: 800, fontSize: 15 };

function StatTile({ label, value, tone }: { label: string; value: number | string; tone?: "green" }) {
  return (
    <div style={{ background: tone === "green" ? "#E8F5E1" : "#F0EEE9", borderRadius: 12, padding: "12px 16px", minWidth: 92 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: tone === "green" ? "#3c7d2b" : "#2f302f" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#777", fontWeight: 700 }}>{label}</div>
    </div>
  );
}

function TrackingSourcesBlock({ sources }: { sources: TrackingSource[] }) {
  if (sources.length === 0) {
    return <div style={{ fontSize: 12.5, color: "#999" }}>No source data from Zoom yet.</div>;
  }
  const max = Math.max(...sources.map((s) => s.registration_count), 1);
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "#777", fontWeight: 700, marginBottom: 6 }}>By source (Zoom)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sources.map((s) => (
          <div key={s.source_name} style={{ fontSize: 12.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{s.source_name}</span>
              <span style={{ color: "#777" }}>
                <b style={{ color: "#2f302f" }}>{s.registration_count}</b> reg · {s.visitor_count} visitors
              </span>
            </div>
            <div style={{ height: 6, background: "#eee", borderRadius: 999, marginTop: 3, overflow: "hidden" }}>
              <div style={{ width: `${(s.registration_count / max) * 100}%`, height: "100%", background: "#0C84A4" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueBlock({ m }: { m: WebinarMetrics }) {
  const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows: [string, string][] = [
    ...(m.isMasterclass
      ? ([["Ticket sales", `${m.tickets} · ${usd(m.ticketRevenue)}`]] as [string, string][])
      : []),
    ["Total revenue (7 days)", usd(m.totalRevenueWithinWindow)],
    ["Revenue / attendee", usd(m.revenuePerAttendee)],
    ["Revenue / registrant", usd(m.revenuePerRegistrant)],
    ["Attendee conversion", `${m.conversionRateAttendees}%`],
    ["No-show conversion", `${m.conversionRateNoShows}%`],
    ["New / Reactivated / Active", `${m.newCustomersCount} / ${m.reactivatedCount} / ${m.activeCount}`],
    ["New attendees", String(m.newAttendees)],
    ["VIP attendees", String(m.vipAttendees)],
  ];
  return (
    <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Revenue — 7-day attribution (§4a)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, background: "#F5F4F0", borderRadius: 8, padding: "6px 10px" }}>
            <span style={{ color: "#777" }}>{k}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
