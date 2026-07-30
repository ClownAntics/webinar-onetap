import { cookies } from "next/headers";
import Link from "next/link";
import PasscodeGate from "../passcode-gate";
import { computeAllWebinarMetrics } from "@/lib/reporting";
import type { WebinarMetrics } from "@/lib/types";
import LineChart, { type Point } from "./line-chart";

export const dynamic = "force-dynamic";

const usd = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

export default async function TrendsPage() {
  const jar = await cookies();
  if (jar.get("admin_ok")?.value !== "1") return <PasscodeGate />;

  let metrics: WebinarMetrics[] = [];
  let skipped = 0;
  let error: string | undefined;
  try {
    const r = await computeAllWebinarMetrics();
    metrics = r.metrics;
    skipped = r.skipped;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const at = (sel: (m: WebinarMetrics) => number): Point[] =>
    metrics.map((m) => ({ x: new Date(m.date).getTime(), y: sel(m) }));

  return (
    <main style={{ minHeight: "100vh", background: "#f5f4f0", color: "#2f302f" }}>
      <header
        style={{
          background: "#2f302f",
          color: "#fff",
          padding: "14px 20px",
          fontWeight: 800,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Webinar Trends</span>
        <Link href="/admin" style={{ color: "#FCD700", fontWeight: 700 }}>
          ← All webinars
        </Link>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <p style={{ color: "#666", fontSize: 13 }}>
            {metrics.length} webinars · revenue attributed on a 7-day window (§4a)
            {skipped > 0 && ` · ${skipped} skipped (no config date)`}
          </p>
          <a
            href="/api/reporting/csv"
            style={{
              background: "#0C84A4",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Download CSV
          </a>
        </div>

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
            Couldn&apos;t compute trends ({error}). Wire the app + sales Supabase, then
            run attendance-sync / backfill to populate data.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          <LineChart title="Total Attended" points={at((m) => m.totalAttended)} color="#3b82c4" />
          <LineChart title="Total Registered" points={at((m) => m.totalRegistered)} color="#54AF3E" />
          <LineChart
            title="Attendance Rate %"
            points={at((m) => m.attendanceRate)}
            color="#8a6d00"
            formatY={(n) => `${n}%`}
          />
          <LineChart
            title="Total Revenue After Webinar (7 Days)"
            points={at((m) => m.totalRevenueWithinWindow)}
            color="#B41F24"
            formatY={usd}
          />
          <LineChart title="New Attendees" points={at((m) => m.newAttendees)} color="#0C84A4" />
        </div>
      </div>
    </main>
  );
}
