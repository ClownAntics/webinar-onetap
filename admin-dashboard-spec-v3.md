# Webinar Admin Dashboard — Claude Design Spec (v3)

Update to the existing "Webinar Admin" prototype. Same brand system: dark big-top theme (#2F302F), Montserrat, CTA yellow #FCD700, white cards. FacePaint.com logo top left.

---

## Screen 1: Webinar List (Dashboard)

The home screen after passcode. A vertical list of webinar cards, upcoming first, then past.

### Each webinar card shows:
- **Banner thumbnail** (small, left side; gray placeholder if none)
- **Display title** + date/time (ET)
- **Status pill** (color-coded, see status list below)
- **Live stats row:**
  - 👥 **Registered: 157** (total)
  - Breakdown chips: SMS 89 · Email 61 · Other 7
  - For past webinars add: ✅ **Attended: 64 (41%)** · No-shows: 93
- **Action hint** — one line telling Aubrey what's needed next, e.g. "Paste agenda when designs confirmed" or "Create blog post + paste replay URL"

### Status pills (the full lifecycle):
| Status | Color | Meaning |
|---|---|---|
| NEEDS SETUP | red | In Zoom, not configured |
| AWAITING ANSWERS | gray | Invites out, answers accumulating |
| EMAIL ARTIST | yellow | Enough answers — send wishlist to presenter |
| AWAITING ARTIST | gray | Waiting on design confirmation |
| NEEDS AGENDA | yellow | Designs confirmed — paste agenda |
| READY | green | All set, automations armed |
| AWAITING BLOG POST | yellow | Webinar done — create blog post, paste replay URL |
| COMPLETE | dark green | Post-webinar sends fired |

Red/yellow = Aubrey action needed. Gray = waiting. Green = good.

Cards with red/yellow statuses sort to the top under a header "Needs your attention".

---

## Screen 2: Webinar Detail

Tapping a card opens the detail screen. Three sections:

### A. Setup panel
- Display title (text input, prefilled from Zoom topic)
- Banner upload (drag/drop + preview)
- Registration question: template dropdown (Product Demo / Webinar / Masterclass / Custom) + editable textarea
- **Agenda / tease copy** (textarea) — helper text: "Feeds the T-3 day tease email. Leave blank to skip."
- **Replay URL** (text input) — only enabled after webinar date passes; helper text: "Pasting this fires the post-webinar sends."
- Discount code (text input, e.g. COREY20)
- Save button (yellow CTA)
- After save: "Copy link for Yumer" button (link with Omnisend merge tags)
- Manual status buttons: **"Emailed artist ✓"** and **"Designs received ✓"** (small secondary buttons, advance the status)

### B. Stats panel
- Big numbers: **Registered** / **Attended** / **Show rate %** (attended only after webinar)
- Registrations by source: mini horizontal bar (SMS / Email / Other)
- Registration timeline: small sparkline (registrations per day since invite)
- After COMPLETE: sends summary — "Attendee code sent to 64 · Replay sent to 93"
- **7-day revenue block** (see README-build-v3.md §4a): Total Revenue After Webinar (7 days), Revenue per Attendee/Registrant, Attendee vs No-show conversion, New/Reactivated/Active customer counts + revenue. Sourced from the `td_order` TeamDesk mirror.

### C. Registrant answers panel
- Header: "What customers want to see (43 answers)"
- Scrollable list: `sarah@… — "More one-stroke flower designs!"`
- **"Copy all answers"** button (for Aubrey's email to the artist)
- Empty state: "Answers appear here as people register."

---

## Screen 3: History view (past webinars)

Same list screen, past section. Each COMPLETE card is tappable → detail becomes read-only recap:
- Final stats (registered, attended, show rate, by-source)
- Sends summary with timestamps
- Link out: replay URL, Zoom report
- **Revenue recap** — the full 7-day attribution block (README-build-v3.md §4a), not a placeholder. This reporting is built in v3.
- **Owner Trends dashboard** (across all webinars): Total Attended, Total Registered, Attendance Rate %, Total Revenue After Webinar (7 days), New Attendees — time-series lines by webinar date. Plus a CSV-export button.

---

## States to include in prototype
1. Dashboard with mixed statuses (2 needing attention, 1 ready, 2 complete)
2. Detail — NEEDS SETUP (empty form)
3. Detail — AWAITING ANSWERS (answers accumulating, stats live)
4. Detail — AWAITING BLOG POST (replay URL field enabled, highlighted)
5. Detail — COMPLETE (read-only recap)

Mobile-first (Aubrey may check from phone), desktop layout ≥880px with panels side-by-side (setup left, stats+answers right).
