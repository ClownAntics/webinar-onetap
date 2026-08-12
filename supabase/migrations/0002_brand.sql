-- Multi-org support: each webinar belongs to one of the three brands.
-- Backfills existing rows to 'facepaint' (everything so far was FacePaint).

alter table webinar_config
  add column if not exists brand text not null default 'facepaint';

alter table webinar_config
  add constraint webinar_config_brand_check
  check (brand in ('facepaint', 'clownantics', 'careerlearning'));
