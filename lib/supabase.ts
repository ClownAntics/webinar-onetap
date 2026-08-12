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
/**
 * Read ALL rows of a query, paging past PostgREST's 1000-row response cap.
 * Pass a builder that applies .range(from, to) — it MUST include a stable
 * .order() so pages don't shift between requests.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

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
