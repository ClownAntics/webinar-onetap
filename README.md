> ⚠️ **SUPERSEDED — do not build from this file.** This v2 handoff is kept for
> reference only. The authoritative build spec is **[README-build-v3.md](README-build-v3.md)**
> (full scope: reporting, revenue attribution, cron, optout). Where anything here
> conflicts with v3, **v3 wins**. Registration-page design tokens/copy below are
> still accurate.

# Handoff: One-Tap Webinar Registration + Admin (FacePaint.com) — v2

## Overview
Mobile-first registration flow replacing Zoom's native form for FacePaint.com webinar invites sent via Omnisend SMS/email. Contact info rides in the URL (`?e=&fn=&ln=&src=`); one tap registers via the Zoom API. Next.js on Vercel at **webinars.facepaint.com**; Zoom Server-to-Server OAuth; Supabase (OneStack instance) for config + event logging. v2 adds the **/admin** setup flow (Aubrey configures each webinar; output is the shareable Omnisend link for Yumer).

## About the Design Files
The .dc.html files are **design references** — clickable prototypes showing intended look and behavior, NOT production code. They use a proprietary streaming-template format; read their inline styles and this README as the source of truth, and recreate in Next.js/React with the codebase's patterns.

- `Webinar Registration.dc.html` — approved registration flow (dark big-top theme; mobile + desktop; default/loading/success/error/missing-email states). Prototype props: firstName, email, missingEmail, simulateError, layout(auto|mobile|desktop).
- `Webinar Admin Dashboard.dc.html` — **v3 admin (CURRENT)**: dashboard + detail with full webinar lifecycle. Supersedes `Webinar Admin.dc.html` (kept only as the earlier reference).
- `admin-dashboard-spec-v3.md` — the v3 admin product spec (lifecycle, tables, states). Where this README and the spec overlap, the spec wins for admin behavior.

## Fidelity
**High-fidelity for the registration pages** — colors, type, spacing, copy are final; recreate pixel-perfect. The admin screen is a functional reference: match the structure and behavior; styling may follow standard internal-tool conventions as long as it stays on-brand (light ground, Montserrat, same button/badge language as the prototype).

## Routes
- `/w/[webinarId]` — landing. Query: `e` (email), `fn` (first name), `ln` (optional), `src` (sms|email|social). Requires a Ready `webinar_config`; unknown/un-set-up id → error state → redirect to the webinar's native Zoom `registration_url`.
- `/admin` — passcode via env var (`ADMIN_PASSCODE`), no user accounts.
- `POST /api/register`, `GET /api/ics/[regId]` (or inline .ics generation).

## Design Tokens (registration pages)
- Background: `#2F302F` · Text: `#FFFFFF` (secondary .85/.65/.6, fine print .4)
- CTA yellow: `#FCD700`, hover `#FFCB39`, solid bottom shadow `0 5px 0 #b89b00`; :active translateY(4px) + `0 1px 0`
- Link/accent blue: `#5cbfdb` (hover → `#FCD700`)
- Confetti dots: `#BC1D78`, `#5BBB47`, `#FCD700`, `#5cbfdb`, `#e25a25` — 7–12px circles scattered absolutely
- Inputs/textarea: bg `rgba(255,255,255,.12)`, border 1.5px `rgba(255,255,255,.45)`, focus border `#FCD700`, radius 14px, text 15px white, placeholder `rgba(255,255,255,.75)`
- Desktop CTA card: bg `rgba(255,255,255,.05)`, border 1px `rgba(255,255,255,.09)`, radius 24px, padding 32px
- Font: **Montserrat** 400/600/700/800/900 (brand primary Futura PT if licensed)
- Radii: primary buttons 18px, small buttons 12–14px, banner 16–18px

## Registration screens

### Landing — mobile (≤879px)
Centered column, max-width 430px, dark stage + confetti. Top→bottom (24px side padding, 14px gaps): logo 76×76 centered → date "MON, AUG 3 · 4:00 PM ET" 12.5px/800/ls 2px yellow → title 29px/900/lh 1.12 white centered → banner (full width, radius 16px, object-fit contain) → "Hi {fn}! One tap and you're in." 15px .85 → **CTA** full-width 68px radius 18px yellow "SAVE MY SEAT" 20px/900/ls .4 → question textarea 2 rows, placeholder from admin `question_text` + " (optional)" → footer pinned bottom: "Registering as {masked} · Not you?" 12.5px (masked = first char + ••• + @domain; "Not you?" expands inline first-name+email panel, bg rgba(255,255,255,.06) r14 p14, inputs 46px, yellow 50px button) → disclosure 11px .4: "By registering, you join the FacePaint.com mailing list. Unsubscribe anytime."

### Landing — desktop (≥880px)
Two columns, max-width 1100px, gap 64px, padding 48px, vertically centered. Left (max 540px): logo 84×84 → date 14px/800/ls 2.5px yellow → title 46px/900/lh 1.08 → banner r18. Right (400px): glass card with greeting 17px/600, same CTA, textarea 3 rows, "Registering as… Not you?", disclosure. Breakpoint = CSS media query in production.

### Loading
CTA disabled; content swaps to 18px spinner (3px border rgba(47,48,47,.3), top #2F302F, .7s linear) + "Saving your seat…".

### Success
Centered column, max-width 480px, dark + confetti: logo → 80px yellow check disc (dark ✓ 40px/900, pop-in scale .6→1.08→1, .45s) → "You're in, {fn}! 🎉" 27px/900 → title 16px/700 → date 13px/800/ls 1.5px yellow → **Add to Google Calendar** 58px yellow r14 → **Add to Apple / Outlook (.ics)** 58px transparent, 2px border rgba(255,255,255,.4) → "Your confirmation with the join link is on its way to {masked}" 13px .6. **No promo slot (removed in v2).**

### Error
64px circle rgba(255,255,255,.1) with yellow "!" → "Hmm, that didn't save." 20px/800 → "No worries — we're sending you to the standard registration page instead." → "Continue to Zoom registration" 52px bg #5cbfdb r12 → spinner + "Redirecting automatically…". Auto-redirect ~3s to Zoom `registration_url`. Never a dead end.

### Missing/invalid `e` param
Greeting+CTA replaced by "Grab your seat — just your name and email." + first-name/email inputs (50px) + yellow CTA (64px). No "Registering as" line.

## Admin — `/admin` (v3 — build from `Webinar Admin Dashboard.dc.html` + `admin-dashboard-spec-v3.md`)

v3 replaces the simple list below with a dark-themed dashboard (ground `#2F302F`, white cards radius 16px, Montserrat; same tokens as the registration pages):

### Dashboard (list)
- Cards grouped: **NEEDS YOUR ATTENTION** (yellow `#FCD700` group header; any red/yellow status) → UPCOMING → PAST
- Each card: banner thumbnail 92×52 r8 (gray "no banner" placeholder) · display title 15px/800 · status pill · date 12.5px · stats row (👥 Registered bold + SMS/Email/Other chips, bg `#F0EEE9` r999; past adds ✅ Attended (n%) green `#3c7d2b` + No-shows gray) · action-hint strip (amber text `#8a6d00` on `#FFF6D6` r8, "→ …") when action needed
- Card hover: 2px `#FCD700` ring. Whole card clicks through to detail.

### Status pills (lifecycle)
NEEDS SETUP red (`#B41F24` on `#FBE3E4`) · AWAITING ANSWERS gray (`#666767` on `#E9E9EB`) · EMAIL ARTIST / NEEDS AGENDA / AWAITING BLOG POST amber (`#8a6d00` on `#FFF3C4`) · AWAITING ARTIST gray · READY green (`#3c7d2b` on `#E8F5E1`) · COMPLETE white on `#2F5D22`. Red/yellow = Aubrey acts; gray = waiting; green = good.

### Detail (three panels; ≥880px: setup left, stats+answers stacked right; mobile: stacked)
Header row: "← All webinars" link (yellow) · title 19px/800 white · status pill · date.
- **Setup** (white card): display title input · banner drop-zone (~1280×400 aspect) · question template dropdown (Product Demo / Webinar / Masterclass / Custom) + editable textarea (templates fill the event topic — see templates in the legacy section below) · **Agenda / tease copy** textarea, helper "Feeds the T-3 day tease email. Leave blank to skip." · **Replay URL** input — disabled with "Enabled after the webinar date" until the date passes; on AWAITING BLOG POST its border/label highlight yellow; helper "Pasting this fires the post-webinar sends." · **Discount code** input (e.g. COREY20) · yellow save CTA ("Save — go live" first time, then "Save changes") · after save: teal **Copy link for Yumer** (flips green "Copied!", reveals merge-tag link in monospace) · small outlined manual-status buttons **"Emailed artist ✓"** / **"Designs received ✓"**. COMPLETE → whole panel read-only with an explanatory strip.
- **Stats** (white card): big-number tiles (Registered; past adds Attended on green tile + Show rate) · by-source stacked bar (SMS `#0C84A4` / Email `#54AF3E` / Other `#C8C8C8`) with legend · registrations-per-day sparkline (yellow bars, "invite sent → today") · on COMPLETE: green sends-summary card ("Attendee code sent to n · Replay sent to m" + timestamp), links "Replay URL ↗ / Zoom report ↗", and a gray "Revenue: coming soon" placeholder
- **Answers** (white card): header "WHAT CUSTOMERS WANT TO SEE (n)" + **Copy all answers** button (outlined, flips "Copied!") · scrollable list of `email — "answer"` rows on `#F5F4F0` r10 · empty state: "Answers appear here as people register."

### Status transitions in the prototype (mirror in production)
Save on NEEDS SETUP → AWAITING ANSWERS · "Emailed artist ✓" → AWAITING ARTIST · "Designs received ✓" → NEEDS AGENDA · save with agenda filled → READY · save with replay URL on AWAITING BLOG POST → COMPLETE.

---

## Legacy admin reference (v2 — superseded by the dashboard above; question templates + copy-link contract still apply)

### Passcode gate
Dark stage, centered white card 360px r20: logo 72px, "Webinar Admin" 19px/800, passcode input (48px, centered, letter-spacing 3px), dark "Unlock" button 50px. Compares to `ADMIN_PASSCODE` env var.

### Webinar list
Header bar: dark `#2F302F`, logo 44px + "Webinar Admin". Body max-width 880px on light ground `#F5F4F0`. "Upcoming webinars" 22px/800 + hint "pulled from Zoom — create webinars there as usual". One white card per webinar (`GET /users/me/webinars`), r16, hairline border: Zoom topic 15px/700 (ellipsized) + date 12.5px gray; status badge pill — **READY** (green `#3c7d2b` on `#E8F5E1`) or **NOT SET UP** (amber `#8a6d00` on `#FFF3C4`); Ready rows add **Copy link for Yumer** (teal `#0C84A4`, flips green "Copied!" ~2.5s and reveals the link below the row); every row has **Set up / Edit setup** (outlined).

### Setup form (expands inline under the row, bg `#FBFAF7`)
1. **Display title** — prefilled by parsing the Zoom topic ("20260803 Sea Creature Designs (Yasmeen Hart) Webinar" → "Sea Creature Designs with Yasmeen Hart"); freely editable.
2. **Question template** — dropdown + always-editable textarea. Templates fill in the event's topic:
   - Product Demo → "What questions do you have about {topic}?" (e.g. glitter)
   - Webinar → "What kind of {topic} do you want to see?" (e.g. sea creatures)
   - Masterclass → "What specific topics would you like us to cover on {topic}?"
   - Custom → free text
3. **Banner upload** — drop zone at landing aspect (~1280×400 preview) → Supabase Storage bucket `webinar-banners` (public read); generic FP banner fallback if skipped.
4. **Save — mark Ready** (green, press-down shadow) → writes `webinar_config`, badge flips to READY. Cancel link closes.

### Copy link output
`https://webinars.facepaint.com/w/{webinarId}?e=[[contact.email]]&fn=[[contact.firstName]]&src=sms` — Omnisend merge tags baked in; Yumer swaps `src` per channel. Shown in monospace teal under the row after copying.

Footer note on the page: a webinar must be Ready before its landing page goes live; Zoom-side, add the custom question and set it **not required**.

## API behavior
- `POST /api/register`: S2S OAuth (`account_credentials`, cache ~55min) → `POST /v2/webinars/{id}/registrants` with email/first_name/last_name (no last name → "-") + `custom_questions`. Already-registered → success. Zoom error → native reg redirect. Rate-limit; validate webinarId.
- **Zoom question mapping:** admin `question_text` is display-only. The answer submits under the webinar's existing Zoom custom question — fetch its exact title via `GET /webinars/{id}/registrants/questions`. If the webinar has no Zoom custom question, log the answer to Supabase only.
- Log every attempt to `webinar_reg_events`: `{webinar_id, email, source, status(success|error|duplicate), ts}`.

## Calendar events (include personal join_url)
The Zoom registrant API returns the registrant's personal `join_url` — put it in the calendar event description; the calendar entry is all they need on webinar day.
- Google: calendar template URL (title, ET start/end, description with join_url)
- .ics: generated server-side post-registration (`/api/ics/[regId]`), same contents

## Supabase (OneStack instance — coordinate names with Dinesh)
- `webinar_config`: webinar_id (pk) · display_title · banner_url · question_text · show_promo · zoom_topic · start_time · created_at
- `webinar_reg_events`: id · webinar_id · email · source · status · ts
- Storage bucket: `webinar-banners` (public read)

## Env
ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET / SUPABASE_URL / SUPABASE_SERVICE_KEY / ADMIN_PASSCODE

## Build checklist
- [ ] Next.js repo; recreate registration screens pixel-perfect (Montserrat, tokens above)
- [ ] `/api/register` (S2S OAuth, token cache, question mapping, Supabase logging)
- [ ] .ics generation with personal join_url; Google Calendar template URL
- [ ] `/admin` list + setup form + banner upload + copy-link
- [ ] `/w/[webinarId]` reads `webinar_config`; error → Zoom `registration_url`
- [ ] Logo in repo `/public` (asset included here)
- [ ] DNS: webinars.facepaint.com → Vercel

## Assets
- `assets/FP_Logo_144x144.jpg` — FacePaint logo (circle-cropped on dark)
- `assets/Zoom_Sea creatures Design.jpg` — sample webinar banner (1280×400); banners vary per webinar, letterbox with object-fit: contain
