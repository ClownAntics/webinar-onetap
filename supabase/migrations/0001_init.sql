-- Webinar app schema (README-build-v3.md §4). Runs in the OneStack instance.
-- Confirm table names with Dinesh before applying to shared infra.

create table if not exists webinar_config (
  webinar_id        text primary key,
  display_title     text,
  banner_url        text,
  question_text     text,
  zoom_question_title text,
  agenda            text,
  replay_url        text,
  discount_code     text,
  discount_expiry   date,
  status            text not null default 'NEEDS_SETUP',
  zoom_topic        text,
  start_time        timestamptz,
  end_time          timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists webinar_reg_events (
  id              bigint generated always as identity primary key,
  webinar_id      text not null,
  email           text not null,
  first_name      text,
  source          text,
  question_answer text,
  status          text,                         -- success | error | duplicate
  ts              timestamptz not null default now()
);
create index if not exists idx_reg_events_webinar on webinar_reg_events (webinar_id);
create index if not exists idx_reg_events_email on webinar_reg_events (lower(email));

create table if not exists webinar_attendance (
  id           bigint generated always as identity primary key,
  webinar_id   text not null,
  email        text not null,
  attended     boolean not null default false,
  duration_min integer,
  ts           timestamptz not null default now(),
  unique (webinar_id, email)
);
create index if not exists idx_attendance_email on webinar_attendance (lower(email));

create table if not exists webinar_send_log (
  id         bigint generated always as identity primary key,
  webinar_id text not null,
  send_type  text not null,
  email      text not null,
  ts         timestamptz not null default now(),
  unique (webinar_id, send_type, email)          -- idempotency guard
);

create table if not exists webinar_optouts (
  id    bigint generated always as identity primary key,
  email text not null unique,
  ts    timestamptz not null default now()
);

-- Optional: persisted per-webinar metrics (§4a) so the Trends dashboard renders
-- without recomputing. Populated by the reporting job.
create table if not exists webinar_summary (
  webinar_id                 text primary key,
  topic                      text,
  webinar_date               date,
  total_registered           integer,
  total_attended             integer,
  total_no_shows             integer,
  attendance_rate            integer,
  new_attendees              integer,
  returning_attendees        integer,
  vip_attendees              integer,
  registered_who_are_customers integer,
  total_revenue_within_window numeric,
  revenue_per_attendee       numeric,
  revenue_per_registrant     numeric,
  new_customers_count        integer,
  new_customers_revenue      numeric,
  reactivated_count          integer,
  reactivated_revenue        numeric,
  active_count               integer,
  active_revenue             numeric,
  computed_at                timestamptz not null default now()
);
