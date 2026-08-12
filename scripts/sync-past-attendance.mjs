#!/usr/bin/env node
/**
 * One-shot: run attendance-sync for every past webinar Zoom still has reports
 * for. Complements the cron (which only catches webinars ended <24h ago) and
 * the sheet backfill (history beyond Zoom's report retention).
 *
 * Usage: node --env-file=.env.local scripts/sync-past-attendance.mjs [--site https://webinar-onetap.vercel.app]
 */
const site = process.argv.includes("--site")
  ? process.argv[process.argv.indexOf("--site") + 1]
  : "https://webinar-onetap.vercel.app";

const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_HOST_USER_ID } = process.env;
if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET || !ZOOM_HOST_USER_ID) {
  console.error("Missing ZOOM_* env vars (run with --env-file=.env.local).");
  process.exit(1);
}

const tokenRes = await fetch(
  `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64")}`,
    },
  }
);
if (!tokenRes.ok) { console.error("Zoom token failed:", await tokenRes.text()); process.exit(1); }
const { access_token } = await tokenRes.json();

const listRes = await fetch(
  `https://api.zoom.us/v2/users/${encodeURIComponent(ZOOM_HOST_USER_ID)}/webinars?type=past&page_size=300`,
  { headers: { Authorization: `Bearer ${access_token}` } }
);
if (!listRes.ok) { console.error("listWebinars failed:", await listRes.text()); process.exit(1); }
const { webinars = [] } = await listRes.json();
console.log(`${webinars.length} past webinars from Zoom`);

let ok = 0, failed = 0;
for (const w of webinars) {
  const res = await fetch(`${site}/api/attendance-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webinarId: String(w.id) }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    ok++;
    console.log(`✓ ${w.id}  ${w.topic}  reg=${data.registrants} att=${data.attended}`);
  } else {
    failed++;
    console.log(`✗ ${w.id}  ${w.topic}  ${data.error ?? res.status}`);
  }
}
console.log(`Done: ${ok} synced, ${failed} failed.`);
