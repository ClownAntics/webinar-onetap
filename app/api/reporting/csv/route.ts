import { NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { computeAllWebinarMetrics } from "@/lib/reporting";
import type { WebinarMetrics } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const COLUMNS: { key: keyof WebinarMetrics; label: string }[] = [
  { key: "webinarId", label: "Webinar ID" },
  { key: "topic", label: "Webinar Topic" },
  { key: "date", label: "Webinar Date" },
  { key: "brand", label: "Brand" },
  { key: "isMasterclass", label: "Masterclass" },
  { key: "tickets", label: "Tickets Sold" },
  { key: "ticketRevenue", label: "Ticket Revenue" },
  { key: "totalRegistered", label: "Total Registered" },
  { key: "totalAttended", label: "Total Attended" },
  { key: "attendanceRate", label: "Attendance Rate %" },
  { key: "totalNoShows", label: "No Shows" },
  { key: "newAttendees", label: "New Attendees" },
  { key: "returningAttendees", label: "Returning Attendees" },
  { key: "vipAttendees", label: "VIP Attendees" },
  { key: "registeredWhoAreCustomers", label: "Registered Who Are Customers" },
  { key: "attendeesWhoBoughtWithinWindow", label: "Attendees Who Bought (7 Days)" },
  { key: "revenueWithinWindowAttendees", label: "Revenue (7 Days) - Attendees" },
  { key: "noShowsWhoBoughtWithinWindow", label: "No Shows Who Bought (7 Days)" },
  { key: "revenueWithinWindowNoShows", label: "Revenue (7 Days) - No Shows" },
  { key: "totalRevenueWithinWindow", label: "Total Revenue (7 Days)" },
  { key: "avgCustomerValueWindow", label: "Avg Customer Value (7 Days)" },
  { key: "conversionRateAttendees", label: "Conversion Rate - Attendees" },
  { key: "conversionRateNoShows", label: "Conversion Rate - No Shows" },
  { key: "revenuePerAttendee", label: "Revenue Per Attendee" },
  { key: "revenuePerRegistrant", label: "Revenue Per Registrant" },
  { key: "avgLagDays", label: "Avg Lag (Days)" },
  { key: "newCustomersCount", label: "New Customers (Count)" },
  { key: "newCustomersRevenue", label: "New Customers Revenue" },
  { key: "reactivatedCount", label: "Reactivated Customers (Count)" },
  { key: "reactivatedRevenue", label: "Reactivated Revenue" },
  { key: "activeCount", label: "Active Customers (Count)" },
  { key: "activeRevenue", label: "Active Revenue" },
];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if ((await getEmployee()).reason !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let metrics: WebinarMetrics[];
  try {
    ({ metrics } = await computeAllWebinarMetrics());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Newest first for the export.
  metrics.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const header = COLUMNS.map((c) => csvCell(c.label)).join(",");
  const body = metrics
    .map((m) => COLUMNS.map((c) => csvCell(m[c.key])).join(","))
    .join("\n");

  return new NextResponse(`${header}\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="webinar-summary.csv"',
    },
  });
}
