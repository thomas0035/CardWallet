-- CardWallet — migration 002: wallet passphrase verification
--
-- Run this in the Supabase SQL editor AFTER schema.sql.
-- Safe to run more than once.
--
-- Adds the value used to check a wallet passphrase is correct before trying to
-- decrypt anything with it.
--
-- Without it there is no way to distinguish a mistyped passphrase from corrupt
-- data: the user would enter a typo, be let through with no complaint, and
-- then find every card failing to decrypt with no explanation. Instead the app
-- derives the key, tries to decrypt this known constant, and rejects the
-- passphrase up front if that fails.
--
-- The stored value is the string 'cardwallet-key-check-v1' encrypted with the
-- wallet key. It reveals nothing: an attacker who reads it still faces the
-- same PBKDF2 work factor as guessing against the cards themselves.

alter table public.profiles
  add column if not exists key_check text;

comment on column public.profiles.key_check is
  'Known constant encrypted with the wallet key, used to verify a passphrase '
  'before attempting decryption. Not secret.';


-- Verify
select
  case when count(*) = 2
       then 'PASS — profiles has both key_salt and key_check'
       else 'FAIL — expected key_salt and key_check, found ' || count(*)
  end as migration_002_check
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'profiles'
  and column_name in ('key_salt', 'key_check');
