# Dev setup

Next.js 16 (App Router, TypeScript) scaffold for the one-tap webinar app.
Product spec: **[README-build-v3.md](README-build-v3.md)** (authoritative).

## Run

```bash
npm install
cp .env.example .env.local   # fill in what you have; the app degrades gracefully
npm run dev                  # http://localhost:3000
```

Verify: `npm run typecheck` and `npm run build`.

The app boots with **no env configured** — integrations that aren't wired up are
skipped (with console warnings) so you can develop pages incrementally.

## Routes

| Route | What it does | State |
|---|---|---|
| `/w/[webinarId]` | One-tap registration (form / loading / success / error / missing-email) | Built (tokens wired; desktop layout minimal) |
| `/admin` | Passcode gate → webinar list from Zoom + Trends link | Built (list only) |
| `/admin/[webinarId]` | Detail: setup + status lifecycle, stats, 7-day revenue, answers | **Built** |
| `/admin/trends` | Owner Trends dashboard — 5 charts over time + CSV (§4a) | **Built** |
| `POST /api/admin/webinar/save` | Save setup, advance status, fire replay-save sends | **Built** |
| `POST /api/admin/webinar/status` | Manual transitions (emailed artist / designs received) | **Built** |
| `/optout` | Webinar opt-out + undo | Built |
| `POST /api/register` | Zoom register → log → Omnisend event | Built |
| `GET /api/ics/[regId]` | .ics with personal join_url | Built (reads details from query; DB lookup TODO) |
| `POST /api/attendance-sync` | Zoom participant report → match → upsert `webinar_attendance` | **Built** |
| `GET /api/reporting/csv` | Webinar Summary CSV (all §4a metrics) | **Built** |
| `GET /api/cron` | Scheduler: after-end attendance-sync wired; tease/reminder TODO | Partial |
| `POST /api/optout` | opt-out write + Omnisend tag | Built |

## Key modules

- `lib/reporting.ts` — **revenue attribution engine** (§4a), a faithful port of the
  Apps Script: 7-day window, New/Reactivated/Active segmentation, VIP tiers. Reads
  `td_order` from the sales Supabase.
- `lib/zoom.ts` — S2S OAuth (55-min token cache), list webinars, add registrant.
- `lib/supabase.ts` — two clients: app (OneStack) + read-only sales mirror.
- `lib/omnisend.ts`, `lib/calendar.ts` — events + Google/ICS calendar.

## Database

`supabase/migrations/0001_init.sql` — the `webinar_*` schema (+ optional
`webinar_summary`). Apply to the OneStack instance (confirm names with Dinesh).
Revenue reads from the separate read-only `af-sales-research` mirror.

## Trends dashboard

`/admin/trends` computes metrics **live** via `computeAllWebinarMetrics()`
(reads `webinar_attendance` + `webinar_config` from the app DB, joins `td_order`
from the sales mirror). The `webinar_summary` table in the migration is ready if
you later want to cache results instead of recomputing per load. A webinar needs
a `webinar_config` row with `start_time` to appear (others are counted as
"skipped").

## Backfill (one-time)

Import the historical "Zoom Registrant Info" sheet into Supabase:

1. In Google Sheets, open the **Past Zoom Data** tab → File → Download → CSV.
2. Fill `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` in `.env.local`.
3. Dry-run first (parses + prints a summary, no writes):
   ```bash
   node scripts/backfill.mjs "Past Zoom Data.csv" --dry-run
   ```
4. Load it:
   ```bash
   npm run backfill -- "Past Zoom Data.csv"
   # or with Omnisend attendee tagging (slow):  ... -- "Past Zoom Data.csv" --tags
   ```

The script writes minimal `webinar_config` rows (id, topic, parsed display title,
`start_time` at noon UTC on the webinar day, status COMPLETE), `webinar_reg_events`
(`source='backfill'`), and deduped `webinar_attendance`. It **excludes** the host
(`gbcabot@gmail.com` / "Blake Cabot"), tolerates variable custom-question columns,
and is idempotent (re-running replaces prior backfill rows for those webinars).
Once loaded, `/admin/trends` lights up.

## Status lifecycle

`lib/status.ts` owns the 8-state lifecycle (README-build-v3.md §3). Transitions:
save on NEEDS_SETUP → AWAITING_ANSWERS · answers ≥ 10 → EMAIL_ARTIST (auto) ·
"Emailed artist ✓" → AWAITING_ARTIST · "Designs received ✓" → NEEDS_AGENDA ·
save with agenda → READY · end_time passes → AWAITING_BLOG_POST (auto) · paste
replay URL → COMPLETE (fires attendee/no-show sends, idempotent via
`webinar_send_log`). COMPLETE locks the setup panel.

## Not built yet (next passes)

- `cron` tease/reminder sends (attendance-sync after end_time + replay-save trigger are wired).
- Banner **file upload** to Supabase Storage (the field currently takes a pasted public URL).
- Dashboard cards: status pills + live stat chips (list links to detail already).
- Pixel-perfect desktop registration layout + "Not you?" inline panel.
- Optional: persist `webinar_summary` (recompute job) instead of live compute.
