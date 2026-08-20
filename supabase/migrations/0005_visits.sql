-- Landing-page visit log: the denominator for per-source conversion rates
-- (visitors -> registrations). One row per page load (client beacon, so most
-- bots are excluded). Preview-mode loads are never logged.

create table if not exists webinar_visits (
  id         bigint generated always as identity primary key,
  webinar_id text not null,
  source     text,
  ts         timestamptz not null default now()
);
create index if not exists idx_visits_webinar on webinar_visits (webinar_id);

alter table webinar_visits enable row level security;
