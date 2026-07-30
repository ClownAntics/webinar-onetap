// Shared domain types. Mirrors the Supabase schema in README-build-v3.md §4.

export type RegistrationSource = "sms" | "email" | "social" | "backfill";

export type WebinarStatus =
  | "NEEDS_SETUP"
  | "AWAITING_ANSWERS"
  | "EMAIL_ARTIST"
  | "AWAITING_ARTIST"
  | "NEEDS_AGENDA"
  | "READY"
  | "AWAITING_BLOG_POST"
  | "COMPLETE";

export interface WebinarConfig {
  webinar_id: string;
  display_title: string | null;
  banner_url: string | null;
  question_text: string | null;
  zoom_question_title: string | null;
  agenda: string | null;
  replay_url: string | null;
  discount_code: string | null;
  discount_expiry: string | null; // ISO date
  status: WebinarStatus;
  zoom_topic: string | null;
  start_time: string | null; // ISO timestamptz
  end_time: string | null;
  created_at: string;
}

export interface RegisterRequest {
  webinarId: string;
  email: string;
  firstName: string;
  lastName?: string;
  source: RegistrationSource;
  answer?: string;
}

export interface RegisterResult {
  status: "success" | "duplicate" | "error";
  joinUrl?: string;
  title?: string;
  startTime?: string;
  message?: string;
}

// --- Reporting (§4a) ---

export interface AttendanceRow {
  webinar_id: string;
  email: string;
  attended: boolean;
  duration_min: number | null;
}

export interface SalesOrder {
  email: string;
  date: string; // ISO date
  orderNumber: string;
  amount: number; // TotalCostCalced
}

export interface WebinarMetrics {
  webinarId: string;
  topic: string;
  date: string;
  totalRegistered: number;
  totalAttended: number;
  totalNoShows: number;
  attendanceRate: number;
  newAttendees: number;
  returningAttendees: number;
  vipAttendees: number;
  registeredWhoAreCustomers: number;
  attendeesWhoBoughtWithinWindow: number;
  revenueWithinWindowAttendees: number;
  noShowsWhoBoughtWithinWindow: number;
  revenueWithinWindowNoShows: number;
  totalRevenueWithinWindow: number;
  avgCustomerValueWindow: number;
  conversionRateAttendees: number;
  conversionRateNoShows: number;
  revenuePerAttendee: number;
  revenuePerRegistrant: number;
  avgLagDays: number | null;
  newCustomersCount: number;
  newCustomersRevenue: number;
  reactivatedCount: number;
  reactivatedRevenue: number;
  activeCount: number;
  activeRevenue: number;
}
