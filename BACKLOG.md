# Backlog — parked items

_Running list of known issues and agreed-but-unbuilt work. Nothing here is in
production unless it says so. Last updated 2026-08-20._

## Blocked on Blake / external

- **Login dumps users into af-tag-review.** ➡️ ACCEPTED AS-IS 2026-08-20:
  Blake's call — the team just uses the canonical
  `https://webinar-onetap.vercel.app/admin` link, which is allow-listed and
  works. No Supabase change. Staging and preview-URL logins will still land in
  af-tag-review; if that ever starts biting, the fix is the two Redirect URLs
  below. (Original notes kept for that eventuality.) Hit Aubrey 2026-08-18; **resolved
  for her** by using the canonical `https://webinar-onetap.vercel.app/admin`,
  which confirms production IS allow-listed and her original link was some
  other URL (stale bookmark or a per-deploy preview URL). Root cause: the
  shared Supabase project's Auth *Site URL* points at tag review, and any login
  whose `redirectTo` isn't an exact match in Auth → URL Configuration →
  **Redirect URLs** silently falls back to it. **Prevention (not yet done):**
  add `https://webinar-onetap-*-bcabot202s-projects.vercel.app/auth/callback`
  (previews) and `https://webinar-onetap-staging.vercel.app/auth/callback`;
  tell the team to bookmark the canonical URL. Not fixable in this repo —
  Supabase decides before the request reaches the app.
- ✅ FIXED 2026-08-20 — **`OMNISEND_API_KEY_CLOWNANTICS` now set and verified.**
  Blake re-saved it; probe shows 75 chars and a live contact-create against the
  Clownantics Omnisend API returned 200. (Was: three save attempts stored 0
  characters.) All three event types
  seeded 2026-08-20, so the triggers show in the Clownantics flow-builder
  dropdown. ⚠️ Only build flows on `registered` / `attended` — `starting` is in
  the dropdown but will not fire (T-15 gated off on the free plan).
- **Zoom dashboard scope** (`dashboard:read:list_webinars:admin`) for
  `/api/zoom-history` — would recover the Feb–May 2026 masterclass sessions
  (attendance + registrations) that predate the app. Older classes are likely
  past Zoom's retention regardless.

## Link / registration issues

- ✅ DONE 2026-08-18 — Yumer link now carries `ln=[[contact.last_name]]` and
  uses **snake_case** tags throughout (`contact.first_name`), matching the
  format proven across his 173 real registrations. The camelCase form from
  `README-build-v3.md` was never verified to expand.
  **⚠️ Worth one confirmation from Yumer:** have him paste the copied link into
  a test send and check the name resolves — the evidence is strong but indirect.
- ✅ DONE 2026-08-18 — hardcoded `src=sms` replaced by a channel picker on both
  copy buttons; untagged links now record "direct" instead of "sms".

## Website use of the one-tap link (discussed 2026-08-18)

- ✅ DONE 2026-08-18 — `src` sanitized and free-form; missing tag records
  "direct"; "Copy link for Aubrey" produces the plain website/social/blog link;
  last-name field added to that form.
- **OPEN — anonymous visitors can't be one-tapped.** Page already degrades to a short
  form. Options discussed, in recommended order: (1) remember past registrants
  in a first-party cookie so any prior email/SMS registrant gets one-tap on the
  website too; (2) have the Shopify template inject logged-in customers' email
  + name into the link; (3) keep the form for genuine strangers. Do NOT drop
  the name fields — Zoom requires a name, and `-` breaks Yumer's
  personalization.

## Vercel Hobby cron limit (2026-08-20)

- ✅ RESOLVED BY DECISION 2026-08-20 — **cron is now daily (`0 5 * * *` UTC,
  ~1am ET), and the T-15 "webinar starting" SMS is dropped.** Hobby caps cron at
  once per day and *fails the deployment* on a more frequent expression, so the
  original `*/15 * * * *` could never have shipped. Blake chose the free option
  over Vercel Pro. The T-15 code is intact but gated behind
  `STARTING_ENABLED = false` in `app/api/cron/route.ts` — a daily tick would
  otherwise text a coincidental few registrants and skip everyone else.
  **⚠️ Tell Yumer not to build the SMS flow — its trigger event will not fire.**
  Note `maxDuration = 300` is **fine** on Hobby (fluid compute: default and max
  are both 300s) — an earlier concern that turned out not to apply.
- **OPEN — restoring T-15 needs sub-daily cron.** Either Vercel Pro ($20/mo,
  zero code change) or an external caller hitting `/api/cron` every 15 min:
  Supabase `pg_cron` + `pg_net` are *available but not installed* in
  `rilhgeshkypbcckedaoh` (shared project — enabling extensions affects
  af-tag-review et al.); GitHub Actions is free but too imprecise for T-15.
  Requires the `CRON_SECRET` item below first.
- **⚠️ Daily cron delays everything else too.** Attendance sync, the Zoom-native
  registration sweep, "webinar attended" events, and the summary cache now lag
  by up to ~24h (Hobby timing is also ±59 min). Registration → Omnisend is
  unaffected — the register route pushes inline, not via cron.
- **`/api/cron` is an unauthenticated GET** — anyone with the URL can trigger
  it. Idempotent via `webinar_send_log`, so it cannot double-send, but it burns
  Zoom API calls against the rate limit. Add a `CRON_SECRET` bearer check.
  Required anyway if an external scheduler ends up calling it.

## Merged to `master` 2026-08-20 (built on `staging`, not yet deployed)

Merged as f6a76be; clean merge, `tsc --noEmit` + `npm run build` both pass.
NOT deployed yet — cron limit resolved, awaiting deploy.
Staging: https://webinar-onetap-staging.vercel.app · TEST webinar 87555460720

- Omnisend integration (per-brand; events + rolling properties + one tag),
  verified end-to-end for FacePaint; all three event types seeded so they appear
  in Yumer's flow-trigger dropdowns.
- Cron: registration sweep (covers Zoom-native registrants, doubles as retry),
  T-15 `webinar starting` events carrying each person's join link, `webinar
  attended` events — all idempotent via `webinar_send_log`.
- Visit tracking (`webinar_visits`, migration 0005 applied) → visitors,
  one-tap, and conversion tiles on the detail page. **This is the denominator
  for the "app vs non-app registration %" question that can't be answered
  today.**
- Dashboard: ⚡ one-tap registrations by source blended into Zoom's tracking
  counts (Zoom's API cannot see API registrations), start times on cards.
- ~~Last-name field on the no-name form~~ — shipped to production 2026-08-18.

## Smaller / lower confidence

- Yumer reported the "Copy link" button not working in his browser
  (clipboard API can fail in some contexts) — needs a fallback; unreproduced.
- Answers panel only shows app-registered answers; could pull Zoom registrants.
- Registration stats fetched only for webinars within ~60 days (`RECENT_MS`).
- CareerLearning revenue: their sales aren't in TeamDesk — future integration.
- Poppins font for CareerLearning-branded pages (brand guide specifies it;
  app uses Montserrat everywhere).
