-- CardWallet — verify the schema and Row Level Security are correct.
--
-- Run this in the Supabase SQL editor AFTER schema.sql.
-- Every check below prints PASS or FAIL. All five must say PASS.
--
-- Why this matters: RLS is now the only thing standing between your cards and
-- anyone holding the (publishable, therefore public) anon key. The old Express
-- backend enforced ownership in application code; Postgres enforces it now.
-- Worth proving rather than assuming.

-- ---------------------------------------------------------------------------
-- 1. RLS is switched on for both tables
-- ---------------------------------------------------------------------------
select
  case when bool_and(rowsecurity)
       then 'PASS — RLS enabled on all tables'
       else 'FAIL — RLS is OFF for: ' || string_agg(tablename, ', ') filter (where not rowsecurity)
  end as check_1_rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('cards', 'profiles');


-- ---------------------------------------------------------------------------
-- 2. All seven policies exist (4 on cards, 3 on profiles)
-- ---------------------------------------------------------------------------
select
  case when count(*) = 7
       then 'PASS — all 7 policies present'
       else 'FAIL — expected 7 policies, found ' || count(*)
  end as check_2_policies
from pg_policies
where schemaname = 'public'
  and tablename in ('cards', 'profiles');


-- ---------------------------------------------------------------------------
-- 3. The CVV column is really gone
-- ---------------------------------------------------------------------------
select
  case when count(*) = 0
       then 'PASS — no cvv column exists'
       else 'FAIL — a cvv column is still present'
  end as check_3_no_cvv
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'cards'
  and column_name  ilike '%cvv%';


-- ---------------------------------------------------------------------------
-- 4. The old hand-rolled users table is gone
-- ---------------------------------------------------------------------------
select
  case when count(*) = 0
       then 'PASS — legacy public.users table dropped'
       else 'FAIL — public.users still exists'
  end as check_4_no_legacy_users
from information_schema.tables
where table_schema = 'public' and table_name = 'users';


-- ---------------------------------------------------------------------------
-- 5. THE IMPORTANT ONE — an anonymous caller can read nothing.
--
--    This simulates someone using your public anon key with no logged-in
--    session. Under the old backend this was wide open; it must now return
--    zero rows.
-- ---------------------------------------------------------------------------
set local role anon;

select
  case when count(*) = 0
       then 'PASS — anonymous caller sees 0 cards'
       else 'FAIL — anonymous caller can read ' || count(*) || ' cards'
  end as check_5_anon_blocked
from public.cards;

reset role;


-- ---------------------------------------------------------------------------
-- Reference: what the policies actually say
-- ---------------------------------------------------------------------------
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
