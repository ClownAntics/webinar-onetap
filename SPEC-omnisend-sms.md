# Spec — Omnisend integration + pre-webinar SMS

_Agreed with Blake 2026-08-17 (source: Blake/Yumer meeting transcript + Q&A session).
Status: **spec approved, not yet built**. Build happens on the `staging` branch first._

## Item 1 — Registrants flow into Omnisend

**Brands:** FacePaint + Clownantics (each its own Omnisend account → per-brand API keys).
CareerLearning excluded (their email is on Fresh).

**Coverage:** everyone — instant push when someone registers through the app, plus a
cron sweep that pulls ALL registrants from Zoom (native form, imports) so nothing is
missed. The sweep doubles as the retry path: a failed push self-heals next sweep.
Registration itself NEVER blocks on Omnisend.

**Consent:** email = **subscribed** (landing page already discloses "you join the
mailing list — unsubscribe anytime"). SMS consent is NOT set by the app — that's
gathered by Yumer's post-registration opt-in flow.

**Data model (events + properties, not per-webinar tags):**
- Custom events: `webinar registered`, `webinar attended` — properties:
  `webinar_id`, `webinar_date`, `topic`, `brand`. Yumer's flows trigger off these.
- Contact properties (rolling state): `last_webinar_registered`,
  `last_webinar_attended`, `webinars_attended_count`.
- One permanent tag: `webinar-audience`.
- Yumer's legacy date-tags are NOT written; he rebuilds his few segments on the
  event/property model (his existing tags remain untouched on old contacts).

**Backfill:** none — starts fresh from launch day.

## Item 2 — Join-link event before each webinar (SMS via Omnisend)

- At **T-15 minutes** before start, the cron fires a `webinar starting` custom event
  **per registrant**, carrying their personal `join_url` (pulled from Zoom at send
  time, so native registrants are included), plus `webinar_id`, `topic`, `start_time`.
- **Yumer builds the one-step Omnisend flow**: trigger = `webinar starting` event,
  action = SMS with the join link. Omnisend's consent rules decide who actually
  receives a text. (He can add an email branch for non-SMS contacts if he wants.)
- Idempotent via `webinar_send_log` (send_type `webinar_starting`), so the 15-min
  cron can't double-send.
- No phone field is added to the landing page — it stays one-tap pure.

## Small items (approved)

- Show the webinar **start time** (not just the date) on dashboard cards.
- **Stop sending "-" as last name** to Zoom (last names are unused everywhere).

## Deferred / not doing

- "Copy link for Yumer" clipboard failure in Yumer's browser — investigate later.
- Historical Omnisend backfill.
- Landing-page phone collection.

## Test environment (agreed shape)

- **`staging` branch** → Vercel auto-builds a preview deployment per push
  (separate URL, production untouched).
- **Shared production database + Zoom account** (Blake's call — simpler beats
  isolated). Mitigation: test only against a designated **TEST webinar** in Zoom so
  real webinars never collect test registrants; `gbcabot@gmail.com` is already
  excluded from attendance stats.
- Features above get built and tested on `staging`; merged to `master` only on
  Blake's go.

## Needed from Blake before build starts

1. **Omnisend API keys** (sensitive → Blake sets in Vercel, both Production AND
   Preview environments): `OMNISEND_API_KEY_FACEPAINT`, `OMNISEND_API_KEY_CLOWNANTICS`.
2. In Vercel → Settings → Environment Variables: enable the existing secrets
   (SUPABASE_SERVICE_KEY, ZOOM_*, SALES_*) for the **Preview** environment so the
   staging deployment can run.
3. A designated TEST webinar in Zoom (any future date, name it "TEST — do not join").

## Needed from Yumer after build

- Rebuild webinar segments on events/properties (drop legacy tag imports).
- Post-registration flow triggered by `webinar registered` (incl. SMS opt-in ask).
- SMS flow triggered by `webinar starting` using the `join_url` property.
