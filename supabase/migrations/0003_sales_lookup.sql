-- Sales-lookup performance + correctness for revenue attribution.
-- 1) Index so email lookups against 230k td_order rows don't seq-scan (they
--    were hitting statement timeouts).
-- 2) Case-insensitive matching: ~19k td_order rows have mixed-case emails,
--    which the exact-lowercase IN() match silently missed.

create index if not exists idx_td_order_email_lower
  on td_order (lower("Email"));

create or replace function webinar_orders_for_emails(p_emails text[])
returns table (email text, order_date date, order_number varchar, amount numeric)
language sql
stable
as $$
  select lower("Email"), "Date", "OrderNumber", "TotalCostCalced"
  from td_order
  where lower("Email") = any(p_emails)
    and "Date" is not null
$$;
