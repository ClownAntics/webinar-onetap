import Link from "next/link";
import LoginGate from "./login-gate";
import { getEmployee } from "@/lib/auth";
import StatusPill from "./status-pill";
import { listWebinars, getTrackingSources, type TrackingSource } from "@/lib/zoom";
import { appSupabase } from "@/lib/supabase";
import { STATUS_META, autoAdjust } from "@/lib/status";
import type { WebinarStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CardData {
  id: string;
  title: string;
  startTime: string | null;
  bannerUrl: string | null;
  status: WebinarStatus;
  registered: number | null; // from Zoom tracking sources; null = not fetched
  sources: { name: string; count: number }[];
  attended: number;
  isPast: boolean;
}

// Only pull live Zoom stats for upcoming / recently-ended webinars (bounds API calls).
const RECENT_MS = 60 * 24 * 60 * 60 * 1000;

async function loadDashboard(): Promise<{ cards: CardData[]; zoomError?: string; dbError?: string }> {
  // Zoom webinars (best-effort).
  let zoom: { id: string; topic: string; start_time: string }[] = [];
  let zoomError: string | undefined;
  try {
    const [up, past] = await Promise.all([listWebinars("upcoming"), listWebinars("past")]);
    zoom = [...up, ...past];
  } catch (err) {
    zoomError = err instanceof Error ? err.message : String(err);
  }

  // Config (status/banner/title) + attendance + answer-count from the app DB.
  const configs = new Map<string, { display_title: string | null; zoom_topic: string | null; banner_url: string | null; status: WebinarStatus | null; start_time: string | null }>();
  const attended = new Map<string, number>();
  const answers = new Map<string, number>();
  let dbError: string | undefined;
  try {
    const sb = appSupabase();
    const [cfgRes, attRes, ansRes] = await Promise.all([
      sb.from("webinar_config").select("webinar_id, display_title, zoom_topic, banner_url, status, start_time"),
      sb.from("webinar_attendance").select("webinar_id, attended"),
      sb.from("webinar_reg_events").select("webinar_id, question_answer"),
    ]);
    for (const c of cfgRes.data ?? []) configs.set(c.webinar_id, c);
    for (const r of attRes.data ?? []) if (r.attended) attended.set(r.webinar_id, (attended.get(r.webinar_id) ?? 0) + 1);
    for (const r of ansRes.data ?? [])
      if (r.question_answer && String(r.question_answer).trim())
        answers.set(r.webinar_id, (answers.get(r.webinar_id) ?? 0) + 1);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const ids = [...new Set<string>([...zoom.map((z) => z.id), ...configs.keys()])];
  const now = Date.now();
  const startOf = (id: string) => configs.get(id)?.start_time ?? zoom.find((w) => w.id === id)?.start_time ?? null;

  // Real registration counts + source breakdown from Zoom, for recent/upcoming only.
  const statsIds = ids.filter((id) => {
    const st = startOf(id);
    return !st || new Date(st).getTime() > now - RECENT_MS;
  });
  const statsEntries = await Promise.all(
    statsIds.map((id) =>
      getTrackingSources(id)
        .then((src) => [id, src] as const)
        .catch(() => [id, [] as TrackingSource[]] as const)
    )
  );
  const statsById = new Map<string, TrackingSource[]>(statsEntries);

  const cards: CardData[] = ids.map((id) => {
    const c = configs.get(id);
    const z = zoom.find((w) => w.id === id);
    const startTime = startOf(id);
    const endPassed = startTime ? now > new Date(startTime).getTime() : false;
    const stored: WebinarStatus = c?.status ?? "NEEDS_SETUP";
    const status = autoAdjust(stored, { answersCount: answers.get(id) ?? 0, endPassed });
    const src = statsById.get(id);
    return {
      id,
      title: c?.display_title ?? c?.zoom_topic ?? z?.topic ?? id,
      startTime,
      bannerUrl: c?.banner_url ?? null,
      status,
      registered: src ? src.reduce((s, x) => s + x.registration_count, 0) : null,
      sources: (src ?? [])
        .filter((x) => x.registration_count > 0)
        .map((x) => ({ name: x.source_name, count: x.registration_count }))
        .sort((a, b) => b.count - a.count),
      attended: attended.get(id) ?? 0,
      isPast: endPassed,
    };
  });
  return { cards, zoomError, dbError };
}

export default async function AdminPage() {
  const auth = await getEmployee();
  if (auth.reason !== "ok") return <LoginGate reason={auth.reason} email={auth.email} />;

  const { cards, zoomError, dbError } = await loadDashboard();

  const needsAttention = cards.filter(actionable).sort(byDateAsc);
  const upcoming = cards.filter((c) => !actionable(c) && !c.isPast).sort(byDateAsc);
  const past = cards.filter((c) => !actionable(c) && c.isPast).sort(byDateDesc);

  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header style={{ background: "#2f302f", color: "#fff", padding: "14px 20px", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Webinar Admin</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#bbb", display: "flex", gap: 10, alignItems: "center" }}>
          {auth.email}
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ background: "none", border: "none", color: "#FCD700", fontSize: 12, cursor: "pointer" }}>Sign out</button>
          </form>
        </span>
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Webinars</h2>
          <a href="/admin/trends" style={{ background: "#2f302f", color: "#FCD700", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            📈 Trends &amp; revenue
          </a>
        </div>
        <p style={{ color: "#666", fontSize: 13 }}>
          Pulled from Zoom (service@facepaint.com) — create webinars there as usual.
        </p>

        {zoomError && <Notice text={`Zoom not reachable (${zoomError}). Wire ZOOM_* env vars.`} />}
        {dbError && <Notice text={`App Supabase not reachable (${dbError}). Wire SUPABASE_* env vars.`} />}

        <Group title="Needs your attention" color="#8a6d00" cards={needsAttention} />
        <Group title="Upcoming" cards={upcoming} />
        <Group title="Past" cards={past} />

        {cards.length === 0 && !zoomError && !dbError && (
          <div style={{ color: "#888", fontSize: 14, marginTop: 16 }}>No webinars found.</div>
        )}
      </div>
    </main>
  );
}

/**
 * A card "needs your attention" only if it's red/amber AND still actionable.
 * A never-configured webinar whose date has already passed is NOT actionable
 * (you won't set up a past webinar for one-tap) — it drops to Past instead of
 * cluttering the attention list.
 */
function actionable(c: CardData): boolean {
  const tone = STATUS_META[c.status].tone;
  if (!["red", "amber"].includes(tone)) return false;
  if (c.status === "NEEDS_SETUP" && c.isPast) return false;
  return true;
}

function byDateAsc(a: CardData, b: CardData) {
  return new Date(a.startTime ?? 0).getTime() - new Date(b.startTime ?? 0).getTime();
}
function byDateDesc(a: CardData, b: CardData) {
  return new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime();
}

function Notice({ text }: { text: string }) {
  return (
    <div style={{ background: "#FBE3E4", color: "#B41F24", padding: 12, borderRadius: 8, fontSize: 13, margin: "12px 0" }}>
      {text}
    </div>
  );
}

function Group({ title, cards, color }: { title: string; cards: CardData[]; color?: string }) {
  if (cards.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: color ?? "#999", marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cards.map((c) => <Card key={c.id} c={c} />)}
      </div>
    </section>
  );
}

function Card({ c }: { c: CardData }) {
  const meta = STATUS_META[c.status];
  const showRate = c.registered && c.registered > 0 ? Math.round((c.attended / c.registered) * 100) : 0;
  const needsAttention = actionable(c);
  return (
    <a href={`/admin/${c.id}`} style={{ display: "flex", gap: 14, background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 14, textDecoration: "none", color: "inherit" }}>
      {/* banner thumb */}
      <div style={{ width: 92, height: 52, borderRadius: 8, flexShrink: 0, background: c.bannerUrl ? `center/cover url(${c.bannerUrl})` : "#e6e4df", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 10 }}>
        {!c.bannerUrl && "no banner"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{c.title}</span>
          <StatusPill status={c.status} />
        </div>
        <div style={{ color: "#888", fontSize: 12.5, marginTop: 2 }}>
          {c.startTime ? `${new Date(c.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })}` : "date TBD"}
        </div>

        {/* stat chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, fontSize: 11.5 }}>
          {c.registered != null && <span style={chip}>👥 <b>{c.registered}</b> registered</span>}
          {c.sources.slice(0, 4).map((s) => (
            <span key={s.name} style={chip}>{s.name} {s.count}</span>
          ))}
          {c.isPast && c.attended > 0 && (
            <span style={{ ...chip, background: "#E8F5E1", color: "#3c7d2b" }}>✅ {c.attended}{c.registered ? ` (${showRate}%)` : ""}</span>
          )}
        </div>

        {needsAttention && (
          <div style={{ marginTop: 8, background: "#FFF6D6", color: "#8a6d00", borderRadius: 8, padding: "5px 10px", fontSize: 12 }}>
            → {meta.hint}
          </div>
        )}
      </div>
    </a>
  );
}

const chip: React.CSSProperties = {
  background: "#F0EEE9",
  borderRadius: 999,
  padding: "3px 9px",
  color: "#555",
};
