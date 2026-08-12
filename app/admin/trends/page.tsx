import Link from "next/link";
import LoginGate from "../login-gate";
import { getEmployee } from "@/lib/auth";
import { computeAllWebinarMetrics } from "@/lib/reporting";
import { BRAND_LABELS } from "@/lib/brands";
import type { WebinarMetrics } from "@/lib/types";
import LineChart, { type Point } from "./line-chart";

export const dynamic = "force-dynamic";
// Full-history metrics over ~27k attendance rows + sales lookups takes ~10s.
export const maxDuration = 60;

const usd = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
const usdFull = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Report tabs — each org separate, paid masterclasses in their own tab
// (excluded from FacePaint so free webinars and paid classes never blend).
const TABS: { key: string; label: string; filter: (m: WebinarMetrics) => boolean }[] = [
  { key: "facepaint", label: BRAND_LABELS.facepaint, filter: (m) => m.brand === "facepaint" && !m.isMasterclass },
  { key: "masterclass", label: "Masterclasses", filter: (m) => m.isMasterclass },
  { key: "clownantics", label: BRAND_LABELS.clownantics, filter: (m) => m.brand === "clownantics" && !m.isMasterclass },
  { key: "careerlearning", label: BRAND_LABELS.careerlearning, filter: (m) => m.brand === "careerlearning" && !m.isMasterclass },
];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getEmployee();
  if (auth.reason !== "ok") return <LoginGate reason={auth.reason} email={auth.email} />;

  const sp = await searchParams;
  const tabKey = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "facepaint";
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0];

  let all: WebinarMetrics[] = [];
  let skipped = 0;
  let error: string | undefined;
  try {
    const r = await computeAllWebinarMetrics();
    all = r.metrics;
    skipped = r.skipped;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const metrics = all.filter(tab.filter);
  const isMc = tab.key === "masterclass";
  const totalTickets = metrics.reduce((s, m) => s + m.tickets, 0);
  const totalTicketRev = metrics.reduce((s, m) => s + m.ticketRevenue, 0);
  const totalProductRev = metrics.reduce((s, m) => s + m.totalRevenueWithinWindow, 0);

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
        {/* report tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e6e4df", flexWrap: "wrap" }}>
          {TABS.map((t) => {
            const on = t.key === tab.key;
            const n = all.filter(t.filter).length;
            return (
              <Link
                key={t.key}
                href={`/admin/trends?tab=${t.key}`}
                style={{
                  borderBottom: on ? "3px solid #FCD700" : "3px solid transparent",
                  padding: "8px 14px",
                  marginBottom: -1,
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: on ? "#2f302f" : "#8a8a8a",
                  textDecoration: "none",
                }}
              >
                {t.label}
                <span style={{ marginLeft: 6, color: "#bbb", fontWeight: 700 }}>{n}</span>
              </Link>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
          }}
        >
          <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
            {metrics.length} webinars · revenue attributed on a 7-day window (§4a)
            {isMc && ` · ${totalTickets} tickets, ${usdFull(totalTicketRev)} ticket revenue`}
            {tab.key === "careerlearning" && " · revenue N/A (sales live outside TeamDesk)"}
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
            Download CSV (all tabs)
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

        {metrics.length === 0 && !error ? (
          <div style={{ color: "#888", fontSize: 14, marginTop: 20 }}>
            No {tab.label} webinars with attendance data yet.
          </div>
        ) : (
          <>
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
              {isMc && (
                <LineChart
                  title="Ticket Revenue"
                  points={at((m) => m.ticketRevenue)}
                  color="#7a3ea0"
                  formatY={usd}
                />
              )}
              {tab.key !== "careerlearning" && (
                <LineChart
                  title={isMc ? "Product Revenue After Class (7 Days)" : "Total Revenue After Webinar (7 Days)"}
                  points={at((m) => m.totalRevenueWithinWindow)}
                  color="#B41F24"
                  formatY={usd}
                />
              )}
              <LineChart title="New Attendees" points={at((m) => m.newAttendees)} color="#0C84A4" />
            </div>

            {isMc && (
              <section style={{ background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: 20, marginTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
                  Per-class sales — tickets + 7-day product revenue
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#777", fontSize: 11.5 }}>
                        <th style={th}>Masterclass</th>
                        <th style={th}>Date</th>
                        <th style={thR}>Attended</th>
                        <th style={thR}>Tickets</th>
                        <th style={thR}>Ticket $</th>
                        <th style={thR}>Product $ (7d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...metrics].reverse().map((m) => (
                        <tr key={m.webinarId} style={{ borderTop: "1px solid #f0eee9" }}>
                          <td style={td}>
                            <Link href={`/admin/${m.webinarId}`} style={{ color: "#0C84A4", textDecoration: "none", fontWeight: 700 }}>
                              {m.topic}
                            </Link>
                          </td>
                          <td style={td}>{new Date(m.date).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</td>
                          <td style={tdR}>{m.totalAttended}</td>
                          <td style={tdR}>{m.tickets || "—"}</td>
                          <td style={tdR}>{m.ticketRevenue ? usdFull(m.ticketRevenue) : "—"}</td>
                          <td style={tdR}>{usdFull(m.totalRevenueWithinWindow)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid #2f302f", fontWeight: 800 }}>
                        <td style={td}>Total</td>
                        <td style={td} />
                        <td style={tdR}>{metrics.reduce((s, m) => s + m.totalAttended, 0)}</td>
                        <td style={tdR}>{totalTickets}</td>
                        <td style={tdR}>{usdFull(totalTicketRev)}</td>
                        <td style={tdR}>{usdFull(totalProductRev)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11.5, color: "#999", marginTop: 8 }}>
                  Tickets match the TeamDesk &quot;Annual SKU Unit Sales Table&quot; (valid sales only). &quot;—&quot; = no
                  matching product SKU found for that class.
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const th: React.CSSProperties = { padding: "6px 8px" };
const thR: React.CSSProperties = { padding: "6px 8px", textAlign: "right" };
const td: React.CSSProperties = { padding: "8px" };
const tdR: React.CSSProperties = { padding: "8px", textAlign: "right", whiteSpace: "nowrap" };
