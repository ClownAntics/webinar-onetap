# OneTap Webinars — Design Brief

_A description of the app for design work (Claude Design or any designer). Written 2026-08-24. Factual source of truth for behavior is the code + HANDOFF.md; this file describes what the app **is and looks like** so new screens and marketing material stay consistent._

## What the app is

**OneTap Webinars** turns a Zoom webinar into a **one-tap registration link**. A personalized link (the person's name + email ride in the URL, filled in by Omnisend merge tags at send time) registers them via the Zoom API in one tap — no form — and hands back their personal Zoom join link. A staff-facing admin configures each webinar, tracks registrations by source, collects audience questions, and reports attendance + revenue.

- **Production:** https://webinar-onetap.vercel.app
- **App name:** OneTap Webinars · **Favicon/logo:** a tap-ripple mark (`app/icon.svg`)
- **Stack (context only):** Next.js App Router on Vercel, Supabase, Zoom API, Omnisend

## Who uses it

| Audience | Surface | Goal |
|---|---|---|
| Customers (face painters, clowns, educators) | Landing page `/w/[id]` | Register in one tap on a phone |
| Yumer (marketing) | Admin + Omnisend | Copy the merge-tag link into SMS/email campaigns, build flows |
| Aubrey / Claire (ops & presenters) | Admin | Set up webinars, post website/social links, read audience answers |
| Blake (owner) | Admin + Trends | Revenue, attendance, conversion across brands |

## The three brands (one app, three skins)

Every webinar belongs to one org; the landing page fully re-skins per brand via CSS variables (`lib/brands.ts`). Admin itself is brand-neutral (light ground).

| | **FacePaint.com** (default) | **Clownantics.com** | **CareerLearning.com** |
|---|---|---|---|
| Mood | Playful "dark big-top" | Bright, primary-color playful | Professional, clean, airy |
| Background / text | `#2F302F` dark / white text | White / black text | White / indigo `#2e3192` text |
| CTA button | Yellow `#FCD700`, dark text, hover `#FFCB39`, hard bottom shadow `#b89b00` | Red `#f10505`, white text, hover `#ff2b2b`, shadow `#a80303` | Cyan `#00a3c9`, white text, hover `#14b7dd`, shadow `#007b98` |
| Accent / link | Blue `#5cbfdb` | Blue `#0186ff` | Blue `#146bb5` |
| Confetti dots | Yes — `#BC1D78` `#5BBB47` `#FCD700` `#5cbfdb` `#e25a25` | Yes — logo colors `#f10505` `#45b308` `#f0d000` `#0186ff` `#14bcfc` | **No confetti** (professional audience) |
| Logo treatment | 76px circle crop | Wide, uncropped | Wide, uncropped |
| Typeface | **Montserrat** (400–900) | Montserrat | **Poppins** (brand guide) |

CTA buttons use a signature "chunky" style: 18px radius, solid bottom shadow (`0 5px 0 <shadow>`), and press-down `:active` (translateY(4px)). Inputs: 14px radius, subtle translucent fill, brand-color focus border.

## Screens

### 1. Landing page — `/w/[webinarId]` (public, mobile-first)

One centered column: brand logo → date line (e.g. `FRI DEC 25 12:00 PM ET`) → big display title → optional banner image (~1280×400 designed per webinar) → main content → mailing-list disclosure line.

**States:**
- **One-tap (personalized):** "Hi {FirstName}! One tap and you're in." → big CTA **SAVE MY SEAT** → optional question textarea ("What would you like to see?") → "Registering as m•••@domain.com" → secondary button "Not {Name}? Use a different email". Identity comes from URL params, or from a 1-year first-party cookie for returning registrants hitting the plain link.
- **Form (stranger):** "Grab your seat — just your name and email." → First name / Last name / Email inputs → same CTA + question box.
- **Loading:** spinner + "Saving your seat…"
- **Success:** big ✓ → "You're in, {Name}! 🎉" → date → "Add to Google Calendar" + "Add to Apple / Outlook (.ics)" buttons (hidden when the webinar has no start time) → "Your confirmation with the join link is on its way to …".
- **Error:** "!" mark → "Hmm, that didn't save." → auto-redirects to Zoom's native registration page in 3s (never a dead end).
- **Preview:** admin-only; fixed yellow top banner "PREVIEW — no one is registered"; `&brand=` override lets staff preview any theme.

### 2. Admin dashboard — `/admin` (staff, Google login)

Light ground (`#f5f4f0`), dark header bar, Montserrat. Webinar **cards** in upcoming/past tabs (past filterable per org + Masterclasses). Each card: banner thumb (or "no banner" placeholder), title, status badge, date, and **chips**: `👥 N registered`, per-source **⚡ one-tap chips** (`⚡ email 256`, `⚡ sms 89`, …, blue `#E3F1FA`/`#0C84A4`), attendance, and a `💰 $N (7d)` revenue chip on past cards (hidden for CareerLearning — no attributable revenue model).

**Status badges:** `NEEDS SETUP` (red/pink) → `AWAITING ANSWERS` → `READY` → `COMPLETE`.

### 3. Webinar detail — `/admin/[webinarId]`

Two columns. **Left — Setup:** organization picker (three brand pill-buttons), display title, banner upload, registration question (auto-captured from Zoom), agenda, big **Save — go live** CTA, "Preview landing page" secondary.
**Right — Stats + Answers:** stat tiles (`Registered`, `⚡ One-tap`, `Page visits`, green `Conversion %`, `Zoom visitors`), a **By source** bar list (teal `#0C84A4` bars; currently Zoom-only — an open task blends the app's ⚡ per-source counts in), a post-webinar **Revenue block** (7-day attribution, per-attendee/registrant, ticket sales for masterclasses), and **"What customers want to see (N)"** — scrollable answer cards (`email — "answer"`) with a "Copy all answers" button.

**Copy-link buttons** (teal, flip to green "Copied!"): the Omnisend merge-tag link for Yumer (with a channel picker for `src=`), and the plain website/social link for Aubrey. Fallback state reveals the raw link for manual copy ("Select and copy ↓").

### 4. Trends — `/admin/trends`

Four tabs, never blended: FacePaint (free webinars) / Masterclasses / Clownantics / CareerLearning. Revenue + attendance charts, CSV download.

### 5. Docs — `/help` (plain-language staff guide) and `/developer` (technical reference). Same light card layout as admin.

## Data concepts a design must respect

- **One-tap vs Zoom-native:** Zoom's own tracking cannot see API registrations, so app registrations (⚡) are always shown *blended with or beside* Zoom's counts, marked with the ⚡ glyph.
- **Sources:** free-form lowercase tags (`sms`, `email`, `website`, `social`, `direct`, …) attached to links; they drive per-source visits, registrations, and conversion.
- **Visits + conversion:** landing-page loads (bot-filtered via JS beacon) are the denominator; conversion = one-tap registrations ÷ visits.
- **Names are mandatory:** Zoom rejects blank last names — never design away the name fields.
- **Attendance/revenue lag:** synced nightly; post-webinar views say so rather than showing zeros.

## Voice

Customer-facing copy is warm, short, exclamation-friendly ("You're in! 🎉", "Grab your seat"). Admin copy is plain and factual, with occasional emoji as data glyphs (⚡ 💰 👥), never decoration. CareerLearning surfaces stay emoji-light and professional.
