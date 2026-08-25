-- CardWallet — migration 003: manual card ordering
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- The card list was ordered by created_at DESC, which cannot be changed from
-- the app. Drag-to-reorder needs somewhere to persist the chosen order, or it
-- would reset on the next refresh.
--
-- NOTE: the Supabase SQL editor runs a script as a single transaction, so one
-- failing statement rolls back everything above it. The three steps below are
-- therefore kept independent and can each be run on their own if needed.


-- ---------------------------------------------------------------------------
-- Step 1 — the column. This is the one the app actually needs.
-- ---------------------------------------------------------------------------

alter table public.cards
  add column if not exists sort_order integer not null default 0;


-- ---------------------------------------------------------------------------
-- Step 2 — preserve the order the cards are currently displayed in, so the
--          list does not visibly reshuffle the first time it loads.
--
--          Skip this if you have no cards yet; it is only cosmetic.
-- ---------------------------------------------------------------------------

update public.cards c
   set sort_order = ranked.new_position
  from (
        select
          id,
          (row_number() over (partition by user_id order by created_at desc))::int - 1
            as new_position
        from public.cards
       ) as ranked
 where c.id = ranked.id;


-- ---------------------------------------------------------------------------
-- Step 3 — index, since every read filters by user and sorts by this column.
-- ---------------------------------------------------------------------------

create index if not exists cards_user_id_sort_order_idx
  on public.cards (user_id, sort_order);


-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------

select
  case when count(*) = 1
       then 'PASS — cards.sort_order exists'
       else 'FAIL — sort_order column missing'
  end as migration_003_check
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'cards'
  and column_name  = 'sort_order';
