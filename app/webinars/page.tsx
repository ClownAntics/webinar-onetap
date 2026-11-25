import { cookies, headers } from "next/headers";
import styles from "../w/[webinarId]/registration.module.css";
import { BrandLogo } from "../w/[webinarId]/registration-client";
import { getBrand } from "@/lib/brands";
import { appSupabase } from "@/lib/supabase";
import { brandFor, listOpenWebinars, PASS_THROUGH, type OpenWebinar } from "@/lib/open-webinars";

export const dynamic = "force-dynamic";

/**
 * Public list of the brand's webinars open for sign-up. Reached from the
 * "Sign up for another webinar" button on the success screen, from /next
 * when nothing is scheduled, or directly (e.g. the website). The src tag
 * (and any identity) is carried into every sign-up link, so a second
 * sign-up that started on Instagram still counts as Instagram.
 */

function formatDate(iso: string): string {
  return (
    new Date(iso)
      .toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      })
      .toUpperCase()
      .replace(",", "") + " ET"
  );
}

/** Email from the returning-registrant cookie, if any (see /w page). */
async function rememberedEmail(): Promise<string | null> {
  try {
    const raw = (await cookies()).get("onetap_identity")?.value;
    if (!raw) return null;
    const v = JSON.parse(decodeURIComponent(raw)) as { e?: string };
    return typeof v.e === "string" && v.e.includes("@") ? v.e : null;
  } catch {
    return null;
  }
}

/** Which of these webinars the person is already signed up for. */
async function alreadyRegistered(email: string | null, list: OpenWebinar[]): Promise<Set<string>> {
  if (!email || list.length === 0) return new Set();
  try {
    const escaped = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data } = await appSupabase()
      .from("webinar_reg_events")
      .select("webinar_id")
      .in("webinar_id", list.map((w) => w.webinar_id))
      .ilike("email", escaped)
      .in("status", ["success", "duplicate"]);
    return new Set((data ?? []).map((r: { webinar_id: string }) => r.webinar_id));
  } catch {
    return new Set();
  }
}

export default async function OpenWebinarsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const h = await headers();
  const brandKey = brandFor(h.get("x-forwarded-host") ?? h.get("host"), get("brand"));
  const brand = getBrand(brandKey);

  let list: OpenWebinar[] = [];
  try {
    list = await listOpenWebinars(brandKey);
  } catch {
    list = [];
  }
  const done = await alreadyRegistered(get("e") ?? (await rememberedEmail()), list);

  const carry = new URLSearchParams();
  for (const k of PASS_THROUGH) {
    const v = get(k);
    if (v) carry.set(k, v);
  }
  const qs = carry.toString();

  return (
    <div className={styles.stage} style={brand.vars as React.CSSProperties}>
      <div className={styles.column}>
        <BrandLogo brand={brand} />
        <h1 className={styles.title}>Free webinars</h1>
        {list.length === 0 ? (
          <p className={styles.greeting}>
            No webinars are open for sign-up right now. Check back soon — new ones are added every few weeks.
          </p>
        ) : (
          <>
            <p className={styles.greeting}>Pick one to save your seat.</p>
            {list.map((w) =>
              done.has(w.webinar_id) ? (
                <div key={w.webinar_id} className={styles.secondaryBtn} style={cardStyle} aria-disabled>
                  <span className={styles.date}>{formatDate(w.start_time)}</span>
                  <span style={cardTitle}>{w.title}</span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>✓ You&apos;re signed up</span>
                </div>
              ) : (
                <a
                  key={w.webinar_id}
                  href={`/w/${w.webinar_id}${qs ? `?${qs}` : ""}`}
                  className={styles.secondaryBtn}
                  style={cardStyle}
                >
                  <span className={styles.date}>{formatDate(w.start_time)}</span>
                  <span style={cardTitle}>{w.title}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--fp-yellow)" }}>Sign up →</span>
                </a>
              )
            )}
          </>
        )}
        <p className={styles.disclosure}>{brand.disclosure}</p>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  height: "auto",
  minHeight: 0,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
  textAlign: "left",
  textDecoration: "none",
  whiteSpace: "normal",
};

const cardTitle: React.CSSProperties = { fontSize: 16.5, fontWeight: 900, lineHeight: 1.2 };
