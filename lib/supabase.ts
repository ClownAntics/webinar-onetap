import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * App "OneStack" Supabase — read/write for webinar_config, webinar_reg_events,
 * webinar_attendance, webinar_send_log, webinar_optouts + the banners bucket.
 * Uses the service key, so this module is SERVER-ONLY.
 */
let _app: SupabaseClient | null = null;
export function appSupabase(): SupabaseClient {
  if (_app) return _app;
  if (!env.supabase.url || !env.supabase.serviceKey) {
    throw new Error("App Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)");
  }
  _app = createClient(env.supabase.url, env.supabase.serviceKey, {
    auth: { persistSession: false },
  });
  return _app;
}

/**
 * Sales Supabase — read-only mirror of TeamDesk (af-sales-research). Used only
 * by the reporting layer (§4a) to read td_order.
 */
let _sales: SupabaseClient | null = null;
export function salesSupabase(): SupabaseClient {
  if (_sales) return _sales;
  if (!env.sales.url || !env.sales.key) {
    throw new Error("Sales Supabase not configured (SALES_SUPABASE_URL / SALES_SUPABASE_KEY)");
  }
  _sales = createClient(env.sales.url, env.sales.key, {
    auth: { persistSession: false },
  });
  return _sales;
}
