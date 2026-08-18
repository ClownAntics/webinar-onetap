import Link from "next/link";
import LoginGate from "./login-gate";
import { getEmployee } from "@/lib/auth";
import DashboardTabs, { type CardData } from "./dashboard-tabs";
import { listWebinars, getTrackingSources, type TrackingSource } from "@/lib/zoom";
import { appSupabase, fetchAllRows } from "@/lib/supabase";
import { autoAdjust, isActionable } from "@/lib/status";
import type { Brand } from "@/lib/brands";
import type { WebinarStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  const configs = new Map<string, { display_title: string | null; zoom_topic: string | null; banner_url: string | null; status: WebinarStatus | null; start_time: string | null; brand: Brand | null }>();
  const attended = new Map<string, number>();
  const answers = new Map<string, number>();
  const revenue = new Map<string, number>();
  const appRegs = new Map<string, Map<string, Set<string>>>();
  let dbError: string | undefined;
  try {
    const sb = appSupabase();
    const [cfgRows, attRows, ansRows] = await Promise.all([
      fetchAllRows<{ webinar_id: string; display_title: string | null; zoom_topic: string | null; banner_url: string | null; status: WebinarStatus | null; start_time: string | null; brand: Brand | null }>(
        (from, to) => sb.from("webinar_config").select("webinar_id, display_title, zoom_topic, banner_url, status, start_time, brand").order("webinar_id").range(from, to)
      ),
      fetchAllRows<{ webinar_id: string; attended: boolean }>((from, to) =>
        sb.from("webinar_attendance").select("webinar_id, attended").order("id").range(from, to)
      ),
      fetchAllRows<{ webinar_id: string; question_answer: string | null; source: string | null; email: string; status: string | null }>((from, to) =>
        sb.from("webinar_reg_events").select("webinar_id, question_answer, source, email, status").order("id").range(from, to)
      ),
    ]);
    // Revenue chips come from the webinar_summary cache (refreshed by cron).
    const { data: summaryRows } = await sb
      .from("webinar_summary")
      .select("webinar_id, total_revenue_within_window")
      .limit(1000);
    for (const s of summaryRows ?? [])
      if (s.total_revenue_within_window != null) revenue.set(s.webinar_id, Number(s.total_revenue_within_window));
    for (const c of cfgRows) configs.set(c.webinar_id, c);
    for (const r of attRows) if (r.attended) attended.set(r.webinar_id, (attended.get(r.webinar_id) ?? 0) + 1);
    // One-tap registrations by source (unique emails; Zoom's tracking counts
    // can't see API registrations, so the app is the source of truth here).
    for (const r of ansRows) {
      if (r.status !== "success" || r.source === "backfill") continue;
      const perSrc = appRegs.get(r.webinar_id) ?? new Map<string, Set<string>>();
      const src = r.source ?? "other";
      const set = perSrc.get(src) ?? new Set<string>();
      set.add(r.email.toLowerCase());
      perSrc.set(src, set);
      appRegs.set(r.webinar_id, perSrc);
    }
    for (const r of ansRows)
      if (r.question_answer && String(r.question_answer).trim())
        answers.set(r.webinar_id, (answers.get(r.webinar_id) ?? 0) + 1);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const ids = [...new Set<string>([...zoom.map((z) => z.id), ...configs.keys()])];
  const now = Date.now();
  const startOf = (id: string) => configs.get(id)?.start_time ?? zoom.find((w) => w.id === id)?.start_time ?? null;

  // Real registration counts + source breakdown from Zoom, for recent/upcoming only.
  // Small pool + one retry: a concurrent burst gets rate-limited by Zoom, and a
  // failed fetch must read as "unknown" (null), never as 0 registered.
  const statsIds = ids.filter((id) => {
    const st = startOf(id);
    return !st || new Date(st).getTime() > now - RECENT_MS;
  });
  const statsById = new Map<string, TrackingSource[] | null>();
  const POOL = 4;
  for (let i = 0; i < statsIds.length; i += POOL) {
    await Promise.all(
      statsIds.slice(i, i + POOL).map(async (id) => {
        try {
          statsById.set(id, await getTrackingSources(id));
        } catch {
          try {
            statsById.set(id, await getTrackingSources(id));
          } catch {
            statsById.set(id, null);
          }
        }
      })
    );
  }

  const cards: CardData[] = ids.map((id) => {
    const c = configs.get(id);
    const z = zoom.find((w) => w.id === id);
    const startTime = startOf(id);
    const endPassed = startTime ? now > new Date(startTime).getTime() : false;
    const stored: WebinarStatus = c?.status ?? "NEEDS_SETUP";
    const status = autoAdjust(stored, { answersCount: answers.get(id) ?? 0, endPassed });
    const src = statsById.get(id) ?? null;
    const topicRaw = c?.zoom_topic ?? c?.display_title ?? z?.topic ?? "";
    // One-tap registrations (unique emails per source) — invisible to Zoom's
    // tracking counts, so they're added on top.
    const perSrc = appRegs.get(id);
    const appSources = [...(perSrc ?? new Map<string, Set<string>>())]
      .map(([name, set]) => ({ name, count: set.size }))
      .sort((a, b) => b.count - a.count);
    const appUnique = perSrc
      ? new Set([...perSrc.values()].flatMap((s) => [...s])).size
      : 0;
    const trackingTotal = src ? src.reduce((s, x) => s + x.registration_count, 0) : null;
    return {
      id,
      title: c?.display_title ?? c?.zoom_topic ?? z?.topic ?? id,
      startTime,
      bannerUrl: c?.banner_url ?? null,
      status,
      brand: c?.brand ?? "facepaint",
      isMasterclass: /master ?class/i.test(topicRaw),
      registered: trackingTotal == null && appUnique === 0 ? null : (trackingTotal ?? 0) + appUnique,
      // Keep all channels (incl. SMS at 0), highest first.
      sources: (src ?? [])
        .map((x) => ({ name: x.source_name, count: x.registration_count }))
        .sort((a, b) => b.count - a.count),
      appSources,
      attended: attended.get(id) ?? 0,
      isPast: endPassed,
      revenue7d: revenue.get(id) ?? null,
    };
  });
  return { cards, zoomError, dbError };
}

export default async function AdminPage() {
  const auth = await getEmployee();
  if (auth.reason !== "ok") return <LoginGate reason={auth.reason} email={auth.email} />;

  const { cards, zoomError, dbError } = await loadDashboard();

  const act = (c: CardData) => isActionable(c.status, c.isPast);
  const needsAttention = cards.filter(act).sort(byDateAsc);
  const upcoming = cards.filter((c) => !act(c) && !c.isPast).sort(byDateAsc);
  const past = cards.filter((c) => !act(c) && c.isPast).sort(byDateDesc);

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
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <a href="/help" style={{ color: "#0C84A4", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>User guide</a>
            <a href="/developer" style={{ color: "#0C84A4", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Developer guide</a>
            <a href="/admin/trends" style={{ background: "#2f302f", color: "#FCD700", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              📈 Trends &amp; revenue
            </a>
          </div>
        </div>
        <p style={{ color: "#666", fontSize: 13 }}>
          Pulled from Zoom (service@facepaint.com) — create webinars there as usual.
        </p>

        {zoomError && <Notice text={`Zoom not reachable (${zoomError}). Wire ZOOM_* env vars.`} />}
        {dbError && <Notice text={`App Supabase not reachable (${dbError}). Wire SUPABASE_* env vars.`} />}

        {cards.length === 0 && !zoomError && !dbError ? (
          <div style={{ color: "#888", fontSize: 14, marginTop: 16 }}>No webinars found.</div>
        ) : (
          <DashboardTabs attention={needsAttention} upcoming={upcoming} past={past} />
        )}
      </div>
    </main>
  );
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

