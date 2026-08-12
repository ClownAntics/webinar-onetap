# Handoff — OneTap Webinars (multi-org one-tap webinar app)

_Last updated: 2026-08-12_

## What it is
Turns a Zoom webinar into a **one-tap registration link**. A personalized link
(name + email in the URL) registers the person via the Zoom API and returns their
personal `join_url` — no form. Plus an **admin** to configure each webinar, see
accurate registration stats, and view revenue/attendance trends.

**Scope (as narrowed by Blake, Aug 2026):** the app is *just* easy one-tap signup +
accurate stats + collecting answers. **Post-webinar / marketing (discount codes,
replay sends, tease/reminder emails) is handled OUTSIDE this app** — those fields
were removed.

## Live
- **Repo:** https://github.com/bcabot202/webinar-onetap (public), branch `master`
- **Prod:** https://webinar-onetap.vercel.app  (Vercel project `webinar-onetap`, org `bcabot202s-projects`)
- **Deploy:** `vercel deploy --prod --yes` from the repo. `gh` + `vercel` CLIs are authed as `bcabot202`.
- **Auth:** Supabase Google login, gated to `@clownantics.com` / `@facepaint.com` / `@careerlearning.com`.

## Multi-org branding (Aug 2026)
The app (named **"OneTap Webinars"**, tap-ripple `app/icon.svg` favicon) serves **three
orgs**: FacePaint, Clownantics, CareerLearning — all webinars on the same Zoom account
(`service@facepaint.com`). Each webinar has a `brand` in `webinar_config` (picker in
admin Setup; default `facepaint`). `lib/brands.ts` is the theme source of truth: colors
(real palettes from each org's style guide), logo (`logoShape: "round" | "wide"` —
FacePaint is a 76px circle crop; Clownantics/CareerLearning are wide uncropped),
mailing-list disclosure line, confetti on/off (off for CareerLearning). The landing
page themes itself from the config row; per-brand CSS vars are applied inline at the
page root, which is why `.stage` (not `<body>`) owns background AND text color.
Preview any theme without saving: append `&brand=clownantics` etc. to a `?preview=1` link.
Migration: `supabase/migrations/0002_brand.sql`. CareerLearning's brand font (Poppins)
is not loaded — the app uses Montserrat everywhere (close cousin; upgrade if asked).

## Stack
Next.js 16 (App Router) + TypeScript on Vercel. Supabase for auth + data + the sales
mirror. Zoom Server-to-Server OAuth. (Omnisend is referenced but NOT wired — marketing is out of scope.)

## Supabase (one shared project)
- **Project:** `rilhgeshkypbcckedaoh` (name `af-sales-research`) — also used by af-tag-review + the TeamDesk sales mirror.
- **Auth:** Google provider already configured there (that's why we reused it).
- **App tables:** `webinar_config`, `webinar_reg_events`, `webinar_attendance`, `webinar_send_log`, `webinar_optouts`, `webinar_summary` — **RLS enabled, no policies** (app uses the service_role key, which bypasses RLS). Schema: `supabase/migrations/0001_init.sql`.
- **Sales:** `td_order` (TeamDesk mirror) — read via `SALES_SUPABASE_*` for revenue.
- **Storage:** bucket `webinar-banners` (public, auto-created on first banner upload).
- ⚠️ Security advisor flags ~139 *other* tables in this project with RLS disabled (customer PII exposed to the anon key). Not ours — flag to Dinesh; don't bulk-enable (would break af-tag-review et al.).

## Zoom
- **App:** Server-to-Server OAuth app **"Webinar Data Collector"** (creds in Vercel). Host account: `service@facepaint.com` (Owner).
- **Scopes it needs** (all added): webinar reads, `webinar:write:registrant:admin` (register), `report:read:list_webinar_participants:admin` (attendance), `webinar:read:list_tracking_sources:admin` (registration stats).

### ⚠️ Zoom gotchas (each cost real time — read before touching Zoom)
1. **Webinar scopes are filed under the "Meetings" product** in Add Scopes — there is **no "Webinar" category**. If a scope looks missing, click **Meetings**.
2. **Custom question must be set to _not required_** in Zoom, or `POST registrants` returns **code 300**.
3. **Zoom's API misspells the field** — registration counts in `tracking_sources` come back as **`registrationr_count`** (extra "r"), not `registration_count`. See `lib/zoom.ts`.
4. After adding scopes, **redeploy** — the S2S token is cached ~55 min.
5. To add a scope: marketplace.zoom.us/user/build → Webinar Data Collector → Scopes → Add Scopes → **Meetings** → tick → Save → redeploy.

## Env vars (Vercel prod — all set except Omnisend)
```
ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET / ZOOM_HOST_USER_ID
SUPABASE_URL / SUPABASE_SERVICE_KEY           (service_role key)
SALES_SUPABASE_URL / SALES_SUPABASE_KEY        (same project + service_role)
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
ADMIN_ALLOWED_DOMAINS = clownantics.com,facepaint.com,careerlearning.com
# OMNISEND_API_KEY — not set (marketing handled outside the app)
```
Convention: Claude sets public values via `vercel env add`; Blake sets the secrets himself.
⚠️ Secrets are marked **sensitive** in Vercel → `vercel env pull` writes them EMPTY.
For local scripts, Blake pastes the Supabase secret key into `.env.local` (gitignored);
the newer `sb_secret_...` key style works with supabase-js. The Zoom secret can't be
pulled either — scripts that need Zoom should go through the deployed API instead.

## Routes / features
- **`/w/[webinarId]`** — public one-tap page (personalized / loading / success / error / missing-email). On register failure it **redirects to Zoom's native registration** (never a dead end). `?preview=1` = preview mode (shows the page, registers no one).
- **`/admin`** — **tabbed** dashboard (Needs your attention / Upcoming / Past). Status pills; **registration counts + by-source come from Zoom tracking sources** (all channels incl. SMS at 0). Past never-configured webinars drop to Past.
- **`/admin/[webinarId]`** — detail:
  - **Setup**: display title, banner **upload**, registration question, agenda — **title/agenda/question auto-fill from Zoom** when empty. Save → "Copy link for Yumer" + **Preview** button.
  - **Stats**: Registered + Visitors + by-source (Zoom), Attended/Show-rate (after attendance-sync), **7-day revenue block**.
  - **Answers**: from the app DB — populates as people register *through the app's links*.
- **`/admin/trends`** — 5 time-series charts + CSV export.
- **`/help`**, **`/developer`** — user + developer guides (in-app).
- **APIs:** `register`, `attendance-sync`, `cron`, `ics/[regId]`, `optout`, `admin/webinar/{save,status,banner}`, `reporting/csv`, `auth/callback`, `auth/signout`.

## Reporting
7-day revenue attribution: match attendee/no-show emails to `td_order` (sum `TotalCostCalced` for orders within 7 days of the webinar), day-level matching, New/Reactivated/Active segmentation. `lib/reporting.ts`.

**Historical backfill: DONE (2026-08-12).** 118 webinars / 27,368 reg + attendance rows
(back to 2024-06-10) imported from the "Zoom Registrant Info" sheet ("Past Zoom Data"
tab → `scripts/backfill.mjs`). Sanity numbers at import time: $100,920 total 7-day
attributed revenue across all 118. Idempotent — re-running replaces backfill rows.
⚠️ The xlsx/CSV exports contain customer PII and are **gitignored** (repo is public).

### Data-layer gotchas (each cost real time)
1. **PostgREST caps every response at 1000 rows.** Any full-table read MUST paginate —
   use `fetchAllRows()` in `lib/supabase.ts` (pass a builder with a stable `.order()`).
   Symptom of forgetting: silently truncated stats/charts, no error.
2. **Zoom's API returns webinar `id` as a NUMBER**; the DB keys are text.
   `listWebinars()` normalizes with `String(w.id)` — don't compare raw Zoom ids.
3. **Sales lookups go through the `webinar_orders_for_emails(text[])` SQL function**
   (migration `0003`): matches `lower("Email")` via expression index — case-insensitive
   (~19k td_order rows have mixed-case emails that exact matching silently missed) and
   fast (raw `IN()` on the unindexed 230k-row table hit the 8s statement timeout).
   **Never add `.order()/.range()` to that rpc call** — PostgREST's sort wrapper on
   function results re-triggers the timeout. `loadSalesForEmails` calls it plain and
   splits any email batch whose response fills the 1000-row cap.
4. `/admin/trends` + `/admin/[webinarId]` set `maxDuration = 60` — full-history metrics
   take ~10s.

### Reports (tabbed, Aug 2026)
`/admin/trends` has four tabs: **FacePaint / Masterclasses / Clownantics /
CareerLearning**. Masterclasses (paid; topic matches /masterclass/i) are EXCLUDED from
the FacePaint tab — free webinars and paid classes never blend (Blake's call).
Masterclass tab adds a ticket-revenue chart + per-class table (tickets, ticket $,
7-day product $). Ticket sales come from SQL fn `webinar_masterclass_sales()`
(migration `0004`): td_invoice_line_item ⋈ td_product ⋈ td_order filtered on
`flagValidSale`, grouped by product Description — which **matches the raw Zoom topic**;
reconciles to-the-penny with the TD "Annual SKU Unit Sales Table" report. Missing fn →
tickets show 0/"—" (code degrades, no crash). CareerLearning tab: registrations +
attendance only — their course sales are NOT in TeamDesk (future integration).
CSV export covers all tabs (Brand / Masterclass / Tickets / Ticket Revenue columns).

**Dashboard revenue chips:** past cards show 💰 7-day revenue from the
`webinar_summary` cache, refreshed by `/api/cron` each run (~10s recompute). Past
cards no longer show the banner thumbnail. `POST /api/attendance-sync {all:true}`
syncs every Zoom-listed past webinar AND creates COMPLETE config rows for any without
one (the sheet backfill was FacePaint-only; this filled in Clownantics/CareerLearning/
masterclass webinars on 2026-08-12 — brands then tagged per Blake's mapping).

## Status: done vs. remaining
**Working / done:** one-tap registration (tested end-to-end), Google auth, DB + RLS, tabbed dashboard with Zoom stats, detail setup (Zoom auto-fill + banner upload + preview), revenue/trends + CSV **with full 2024→now history (backfill done)**, attendance-sync, multi-org branding with real palettes + logos, guides, OneTap rename + favicon.

**Removed (out of scope):** discount code/expiry, replay URL, post-webinar sends, Omnisend lifecycle.

**Remaining / follow-ups:**
- Answers panel only sees app-registered answers (fine going forward; could pull from Zoom registrants if ever needed).
- Registration stats are fetched only for webinars within the last ~60 days (`RECENT_MS` in `app/admin/page.tsx`) to bound Zoom API calls.
- Auto-filled registration question can read awkwardly (template stuffs the full title) — a per-webinar edit.
- Custom domain `webinars.facepaint.com` not set up (still on `*.vercel.app`).
- `cron` tease/reminder are stubs (marketing = out of scope, so likely N/A).

## Reference docs in repo
`README-build-v3.md` (original build spec — note: pre-scope-narrowing, so discount/replay/Omnisend there are now out of scope), `SETUP.md` (dev setup), `admin-dashboard-spec-v3.md`.
