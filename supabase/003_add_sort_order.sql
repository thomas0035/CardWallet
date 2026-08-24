-- CardWallet — migration 003: manual card ordering
--
-- Run this in the Supabase SQL editor AFTER 002_add_key_check.sql.
-- Safe to run more than once.
--
-- The card list was ordered by created_at DESC, which is fixed and cannot be
-- changed from the app. Drag-to-reorder needs somewhere to persist the order
-- the user chooses, otherwise it would reset on the next refresh.
--
-- Cards are read with `order by sort_order asc, created_at desc`, so the
-- second key keeps the ordering stable if two rows ever share a sort_order.

alter table public.cards
  add column if not exists sort_order integer not null default 0;

comment on column public.cards.sort_order is
  'Manual display order, ascending. Rewritten as a dense 0..n-1 sequence '
  'whenever the user reorders. New cards are inserted below the current '
  'minimum so they appear first.';


-- Backfill existing rows to preserve the order they are currently displayed
-- in, so nobody''s list visibly reshuffles the first time they open the app
-- after this migration.
with ordered as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at desc
    ) - 1 as position
  from public.cards
)
update public.cards c
   set sort_order = o.position
  from ordered o
 where c.id = o.id
   and c.sort_order = 0;


-- The list is always read filtered by user and sorted by this column.
create index if not exists cards_user_id_sort_order_idx
  on public.cards (user_id, sort_order);


-- Verify
select
  case when count(*) = 1
       then 'PASS — cards.sort_order exists'
       else 'FAIL — sort_order column missing'
  end as migration_003_check
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'cards'
  and column_name  = 'sort_order';
