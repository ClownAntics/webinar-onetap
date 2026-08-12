-- Paid webinar/masterclass ticket sales, reproducing the TeamDesk "Annual SKU
-- Unit Sales Table" view (filter: Order Number - flagValidSale + SKU Type
-- Label = "Face Painting: Webinars").
--
-- The mirror's td_product."Related Type (ref)" column is mis-mirrored (holds
-- dates, not type ids), so the type filter is expressed as its exact SKU
-- equivalent: PFWB% (dated live classes) + PFCS% (evergreen courses) — the 42
-- products verified against the 2026-08-12 TD report export (Linework
-- 28/$420.00, Butterfly 31/$418.53 — exact).

create or replace function webinar_masterclass_sales()
returns table (description text, tickets numeric, revenue numeric)
language sql
stable
as $$
  select
    trim(regexp_replace(p."Description", E'[\\r\\n]+', ' ', 'g')),
    sum(li."Quantity"),
    sum(li."Total Net Discount")
  from td_invoice_line_item li
  join td_product p on p."SKU" = li."SKU"
  join td_order o on o."OrderNumber" = li."Order Number"
  where o."flagValidSale" = true
    and (p."SKU" ilike 'PFWB%' or p."SKU" ilike 'PFCS%')
  group by 1
$$;
