-- Masterclass ticket sales, reproducing the TeamDesk "Annual SKU Unit Sales
-- Table" view (filter: Order Number - flagValidSale + SKU Description).
-- Verified against the 2026-08-12 TD export: Linework 28/$420.00,
-- Butterfly Techniques 31/$418.53 — exact match.

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
    and p."Description" ilike '%masterclass%'
  group by 1
$$;
