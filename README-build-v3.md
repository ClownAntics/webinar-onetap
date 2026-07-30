# One-Tap Webinar Registration — Build Handoff (v3 FINAL)

Next.js (App Router) on Vercel at **webinars.facepaint.com**. Supabase (OneStack instance for config/logging — coordinate table names with Dinesh; **plus** read-only `af-sales-research` for revenue, §4a). Zoom S2S OAuth. Omnisend API.

Companion files: `Webinar Registration.dc.html`, `Webinar Admin Dashboard.dc.html` (current v3 admin prototype) + `Webinar Admin.dc.html` (earlier reference), and `admin-dashboard-spec-v3.md` (v3 admin product spec — where it and this file overlap on admin behavior, the spec wins). Brand: dark #2F302F, Montserrat, CTA #FCD700.

**Zoom host:** all webinars live under one shared Zoom account, `service@facepaint.com` — list that user's webinars (don't rely on `/users/me`).

**Reporting is in scope (§4a).** This app must reproduce the revenue/attendance reporting currently done in Blake's "Zoom Registrant Info" Google Sheet + Apps Script. **Out of scope (stays manual):** presenter/survey reports, Asana, Messenger, and the per-attendee RFM tagging.

---

## 1. Public routes

### `/w/[webinarId]` — one-tap registration
Query: `e` (email), `fn`, `ln` (optional), `src` (sms|email|social).
States: default (personalized "Hi {fn}!", banner, one CTA) · loading · success · error · missing-email (minimal form).
- Success: show "You're registered!" + **Add to Google Calendar** (template URL) + **Download .ics** (client-side data URI). Both contain personal `join_url`, title, ET start/end.
- Error/unknown webinarId: auto-redirect to Zoom native registration (never dead-end).
- "Not you?" link → minimal form → registers + creates new Omnisend contact (tagged source + webinar).
- Footer: small "Stop webinar invites" link → `/optout`.
- Mobile ≤879px / desktop ≥880px (CSS media query).

### `/optout` — webinar-specific opt-out
Query: `e`. Sets Omnisend tag `webinar-optout`, logs to Supabase, confirmation page with undo link. No login.

---

## 2. API routes

### `POST /api/register` (the core)
1. Validate → call Zoom `POST /webinars/{id}/registrants` (custom question answer under exact Zoom question title if configured; fetch titles via `GET /webinars/{id}/registrants/questions`, cache in config)
2. Get `join_url` from response
3. Insert `webinar_reg_events` (incl. question answer text)
4. Fire Omnisend `webinar_registered` event (props: webinar_id, title, start_time, join_url, source). Create/update contact.
5. Return join_url + event data for calendar buttons
Status: success | error | duplicate (duplicate = fetch existing registrant, still return join_url).

### `POST /api/attendance-sync`
Called by cron after end_time. Pull Zoom report (`GET /report/webinars/{id}/participants`), match to registrants by email, upsert `webinar_attendance`. Fire nothing yet — sends wait for replay URL.

### Cron (Vercel cron, e.g. every 15 min)
- T-3 days before start: if agenda non-empty → fire Omnisend `webinar_tease_due` per registrant (props incl. current agenda). If agenda empty → skip.
- T-1 hr: fire `webinar_reminder_due` per registrant (props: join_url).
- After end_time: trigger attendance-sync once.
- All idempotent (log fired sends in `webinar_send_log`).

### Replay save trigger (in admin save handler)
When replay_url transitions empty→set:
- Attendees: fire `webinar_attended` (props: `code`, `discount_expiry`)
- No-shows: fire `webinar_noshow` (props: `replay_url`, `code`, `discount_expiry`)
- First-time attendees: set Omnisend tag `webinar-attendee`
- Status → COMPLETE

**Discount code:** one Shopify code per webinar (e.g. `WB-SCDYHW-15`, 15% off storewide, min $30, one-time-per-customer), created manually in Shopify and typed into the admin. The **same** code goes to attendees and no-shows, applied via `facepaint.com/?discount={code}`. The email advertises the code's **actual Shopify expiry date** — so the admin stores a `discount_expiry` date alongside the code. (There is no app-generated code and no relative "72h" expiry.)

---

## 3. Admin (`/admin`, passcode via ADMIN_PASSCODE)

Per `admin-dashboard-spec-v3.md`:
- **Dashboard:** webinar cards (from Zoom `GET /users/{ZOOM_HOST_USER_ID}/webinars` — the shared `service@facepaint.com` account — merged with config), status pill, live stats (registered total + by-source chips; attended + show-rate for past), action hint. Red/yellow statuses sort top under "Needs your attention".
- **Detail:** setup panel (title, banner→Supabase Storage `webinar-banners`, question template dropdown + textarea, agenda textarea, replay URL [enabled post-webinar], **discount code + discount-expiry date**, Save, Copy-link-for-Yumer, manual buttons "Emailed artist ✓" / "Designs received ✓") · stats panel (big numbers, source bars, reg sparkline, sends summary, **7-day revenue block — see §4a**) · answers panel (list + "Copy all answers", empty state).
- **History:** COMPLETE cards → read-only recap with final revenue metrics (§4a). CSV-export button for the recap.
- **Trends (owner dashboard, §4a):** cross-webinar time-series charts — the primary at-a-glance view.

### Status lifecycle (stored in config, auto+manual transitions)
1. NEEDS SETUP (no config)
2. AWAITING ANSWERS (setup saved → auto)
3. EMAIL ARTIST (auto when answers ≥ threshold, e.g. 10 — or manual)
4. AWAITING ARTIST (manual: "Emailed artist ✓")
5. NEEDS AGENDA (manual: "Designs received ✓")
6. READY (auto when agenda saved)
7. AWAITING BLOG POST (auto when end_time passes)
8. COMPLETE (auto when replay_url saved → sends fire)
Skip logic: agenda never set → 2/3/4/5 can jump to 7 after webinar. Nothing blocks.

---

## 4. Supabase schema (prefix `webinar_`, confirm with Dinesh)

```sql
webinar_config (
  webinar_id text pk, display_title text, banner_url text,
  question_text text, zoom_question_title text, agenda text,
  replay_url text, discount_code text, discount_expiry date, status text,
  zoom_topic text, start_time timestamptz, end_time timestamptz,
  created_at timestamptz default now()
)
webinar_reg_events (
  id bigint pk, webinar_id text, email text, first_name text,
  source text, question_answer text,
  status text, -- success|error|duplicate
  ts timestamptz default now()
)
webinar_attendance (
  id bigint pk, webinar_id text, email text,
  attended bool, duration_min int, ts timestamptz
)
webinar_send_log (
  id bigint pk, webinar_id text, send_type text, email text, ts timestamptz
)
webinar_optouts (id bigint pk, email text, ts timestamptz)
```
Storage bucket: `webinar-banners` (public read).

### Backfill (one-time script, run manually)
Import Blake's "Zoom Registrant Info" Google Sheet (historical registrants + attendance, ~40 webinars back to Sept 2025) → `webinar_reg_events` + `webinar_attendance` (source='backfill'). Set `webinar-attendee` tag in Omnisend for all historical attendees. Note: historic webinars used **different Zoom custom-question titles** (design question, experience-level, etc.) — the importer must tolerate variable columns. Expect attendee tiers (§4a) to rise once full history is loaded vs. the old sheet.

### No Google Sheet export
The nightly Sheet sync is **dropped** — Supabase is the source of truth. Provide a **CSV-download button** in the admin (per-webinar recap + trends) for anyone who wants a spreadsheet. The historical Sheet is used only for the one-time backfill above.

---

## 4a. Reporting (reproduces the "Zoom Registrant Info" sheet + Apps Script)

This is a **required** part of the build, not a placeholder. All figures must reconcile with the current Apps Script so history is continuous.

### Sales data source — TeamDesk mirror (read-only)
Sales come from the **`af-sales-research` Supabase project** (a read-only mirror of TeamDesk; project ref `rilhgeshkypbcckedaoh`), table **`td_order`**. This **replaces the manual "TD Data" CSV paste** — no manual export. Postgres requires double-quoting these mixed-case columns:

| Concept | `td_order` column |
|---|---|
| Order date | `"Date"` (date) |
| Order number | `"OrderNumber"` |
| Customer email | `"Email"` |
| Revenue amount | `"TotalCostCalced"` — customer-paid order total incl. shipping/tax. **Do not** substitute `"Total Invoice Line Revenue Calced"` (lower). |

(The old sheet's `In365?` flag is ignored — it was computed but unused.)

### Attribution rules (match exactly)
- **Attendance** from Zoom **report participants** API; sum duration → minutes; dedupe by email+webinar (keep the attended/guest row); **exclude** `gbcabot@gmail.com` / name "Blake Cabot".
- **Attendee tiers** by lifetime webinar attendance: 1 = New, 2+ = Returning, 5+ = VIP.
- **Revenue attribution: 7-day window** (source of truth). Match attendee/no-show email (lowercased) to `td_order."Email"`; count orders where `webinar_date ≤ "Date" ≤ webinar_date + 7 days`; sum `"TotalCostCalced"`. **Discount code plays no part in attribution** — any purchase within the window counts.
- **Customer segmentation** (attendees who bought in-window): New = no prior order ever; Reactivated = last prior order > 180 days before the webinar; Active = otherwise.
- `registered_who_are_customers` = registrants with any lifetime `td_order`.
- Also compute: attendance rate, conversion rate (attendees / no-shows), revenue per attendee, revenue per registrant, avg lag (days), avg customer value.

### Reporting surfaces
1. **Per-webinar summary** (in the detail Stats panel + History recap): every metric above.
2. **Owner Trends dashboard** (Blake's primary view — new screen): time-series line charts across all webinars by webinar date — **Total Attended, Total Registered, Attendance Rate %, Total Revenue After Webinar (7 days), New Attendees**. (Note: the current sheet chart is mislabeled "30 Days" — the correct window is 7.)

Persist computed per-webinar metrics (e.g. a `webinar_summary` table or view) so trends render without recomputing every load.

---

## 5. Omnisend integration

Events fired by app: `webinar_registered`, `webinar_tease_due`, `webinar_reminder_due`, `webinar_attended`, `webinar_noshow`. All carry fresh props at fire time (agenda/join_url/code/discount_expiry/replay_url/title/start_time).
Tags: `webinar-attendee` (permanent, first attendance), `webinar-optout` (suppression), source+webinar tag on new contacts from "not you?" form.
Yumer builds 5 automations ONCE, triggered by events, copy uses merge props. Every webinar segment includes `AND NOT tag: webinar-optout`.

**Phase 2 fast-follow (do not build in the first release):** on setup save, use Omnisend Campaigns API (v2026-03-15: copy master draft → swap banner/copy via Email Content API) to auto-generate invite drafts for Yumer to review/send.

---

## 6. Env vars
```
ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET
SUPABASE_URL / SUPABASE_SERVICE_KEY               # app "OneStack" instance (config + logging)
SALES_SUPABASE_URL / SALES_SUPABASE_KEY           # read-only af-sales-research (td_order revenue, §4a)
OMNISEND_API_KEY
ADMIN_PASSCODE
ZOOM_HOST_USER_ID  (or email service@facepaint.com)
```
Two Supabase projects: the app's own OneStack instance (confirm table names with Dinesh) and read-only access to `af-sales-research` for revenue.

## 7. External setup (not code)
- Zoom S2S OAuth app (Marketplace, ~10 min) — scopes: webinar read/write, report read
- DNS: webinars.facepaint.com → Vercel
- Aubrey: Zoom custom questions set to NOT required
- Yumer: 5 automations + optout exclusion in saved segments
- Dinesh: confirm Supabase table names in OneStack instance
- Omnisend link format for invites:
  `https://webinars.facepaint.com/w/{ID}?e=[[contact.email]]&fn=[[contact.firstName]]&src=sms` (swap src per channel)

## 8. Build order
1. Register route + `/w/[id]` page (all states) — the core value
2. Supabase tables + logging
3. Omnisend events (registered) + optout route
4. Admin: dashboard + detail (status lifecycle)
5. Cron: tease/reminder/attendance-sync
6. Replay-save trigger + send log
7. Reporting (§4a): `td_order` revenue join, per-webinar summary, owner Trends dashboard, CSV export
8. Backfill script (historical Sheet → reg_events + attendance)
