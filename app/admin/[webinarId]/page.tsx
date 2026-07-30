import { cookies } from "next/headers";
import Link from "next/link";
import PasscodeGate from "../passcode-gate";
import StatusPill from "../status-pill";
import SetupPanel from "./setup-panel";
import CopyButton from "./copy-button";
import { appSupabase } from "@/lib/supabase";
import { getWebinar } from "@/lib/zoom";
import { computeOneWebinarMetrics } from "@/lib/reporting";
import { STATUS_META, autoAdjust } from "@/lib/status";
import { env } from "@/lib/env";
import type { WebinarConfig, WebinarMetrics, WebinarStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RegEvent {
  email: string;
  source: string | null;
  question_answer: string | null;
  ts: string;
}
interface AttRow {
  email: string;
  attended: boolean;
}

interface Detail {
  config: WebinarConfig | null;
  topic: string;
  startTime: string | null;
  regEvents: RegEvent[];
  attendance: AttRow[];
  dbError?: string;
}

async function loadDetail(webinarId: string): Promise<Detail> {
  let config: WebinarConfig | null = null;
  let regEvents: RegEvent[] = [];
  let attendance: AttRow[] = [];
  let dbError: string | undefined;

  try {
    const sb = appSupabase();
    const [cfg, re, att] = await Promise.all([
      sb.from("webinar_config").select("*").eq("webinar_id", webinarId).maybeSingle<WebinarConfig>(),
      sb.from("webinar_reg_events").select("email, source, question_answer, ts").eq("webinar_id", webinarId),
      sb.from("webinar_attendance").select("email, attended").eq("webinar_id", webinarId),
    ]);
    config = cfg.data ?? null;
    regEvents = (re.data ?? []) as RegEvent[];
    attendance = (att.data ?? []) as AttRow[];
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const zw = await getWebinar(webinarId).catch(() => null);
  return {
    config,
    topic: config?.display_title ?? config?.zoom_topic ?? zw?.topic ?? webinarId,
    startTime: config?.start_time ?? zw?.start_time ?? null,
    regEvents,
    attendance,
    dbError,
  };
}

const etDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export default async function WebinarDetail({
  params,
}: {
  params: Promise<{ webinarId: string }>;
}) {
  const { webinarId } = await params;
  if ((await cookies()).get("admin_ok")?.value !== "1") return <PasscodeGate />;

  const d = await loadDetail(webinarId);

  // Stats from reg_events / attendance.
  const registeredEmails = new Set(d.regEvents.map((r) => r.email.toLowerCase()));
  const registered = registeredEmails.size;
  const bySource = { SMS: 0, Email: 0, Other: 0 };
  const perDay = new Map<string, number>();
  const seenForSource = new Set<string>();
  for (const r of d.regEvents) {
    const key = r.email.toLowerCase();
    if (!seenForSource.has(key)) {
      seenForSource.add(key);
      if (r.source === "sms") bySource.SMS++;
      else if (r.source === "email") bySource.Email++;
      else bySource.Other++;
    }
    const day = etDate(r.ts);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const answers = d.regEvents
    .filter((r) => r.question_answer && r.question_answer.trim())
    .map((r) => ({ email: r.email, answer: r.question_answer!.trim() }));

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

  const omnisendLink = `${env.siteUrl}/w/${webinarId}?e=[[contact.email]]&fn=[[contact.firstName]]&src=sms`;

  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header style={{ background: "#2f302f", color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Link href="/admin" style={{ color: "#FCD700", fontWeight: 700 }}>← All webinars</Link>
        <span style={{ fontWeight: 800, fontSize: 17 }}>{d.topic}</span>
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
              display_title={d.config?.display_title ?? d.topic}
              question_text={d.config?.question_text ?? ""}
              agenda={d.config?.agenda ?? ""}
              replay_url={d.config?.replay_url ?? ""}
              discount_code={d.config?.discount_code ?? ""}
              discount_expiry={d.config?.discount_expiry ?? ""}
              banner_url={d.config?.banner_url ?? ""}
              status={status}
              replayEnabled={endPassed}
              omnisendLink={omnisendLink}
            />
          </div>

          {/* Stats + Answers (right) */}
          <div style={{ flex: "1 1 380px", minWidth: 320, display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={card}>
              <div style={cardTitle}>Stats</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatTile label="Registered" value={registered} />
                {hasAttendance && <StatTile label="Attended" value={attended} tone="green" />}
                {hasAttendance && <StatTile label="Show rate" value={`${showRate}%`} tone="green" />}
              </div>

              <SourceBar bySource={bySource} />
              <Sparkline perDay={perDay} />

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

function SourceBar({ bySource }: { bySource: { SMS: number; Email: number; Other: number } }) {
  const total = bySource.SMS + bySource.Email + bySource.Other || 1;
  const seg = (n: number, color: string) => (n > 0 ? <div style={{ width: `${(n / total) * 100}%`, background: color }} /> : null);
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "#eee" }}>
        {seg(bySource.SMS, "#0C84A4")}
        {seg(bySource.Email, "#54AF3E")}
        {seg(bySource.Other, "#C8C8C8")}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "#666", marginTop: 6 }}>
        <span>■ SMS {bySource.SMS}</span>
        <span style={{ color: "#54AF3E" }}>■</span>
        <span style={{ marginLeft: -8 }}>Email {bySource.Email}</span>
        <span>■ Other {bySource.Other}</span>
      </div>
    </div>
  );
}

function Sparkline({ perDay }: { perDay: Map<string, number> }) {
  const days = [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (days.length === 0) return null;
  const max = Math.max(...days.map(([, n]) => n));
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "#777", fontWeight: 700, marginBottom: 4 }}>Registrations / day</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
        {days.map(([day, n]) => (
          <div key={day} title={`${day}: ${n}`} style={{ flex: 1, height: `${(n / max) * 100}%`, background: "#FCD700", borderRadius: 2, minHeight: 2 }} />
        ))}
      </div>
    </div>
  );
}

function RevenueBlock({ m }: { m: WebinarMetrics }) {
  const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows: [string, string][] = [
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
