-- CardWallet — database schema
--
-- Run this in the Supabase SQL editor:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- WARNING: this DROPS the existing `users` and `cards` tables and everything
-- in them. That is intentional — the old rows are test data, and the old
-- `users` table is a hand-rolled auth table that Supabase Auth replaces.
--
-- What changes from the old schema:
--   * `users`             -> deleted. Supabase Auth's built-in `auth.users`
--                            takes over, giving us password reset, email
--                            verification and secure session refresh for free.
--   * `cvv_encrypted`     -> deleted. Storing CVVs is prohibited by PCI-DSS
--                            and gains nothing for personal use.
--   * `card_image_url`    -> deleted. Never read or written anywhere in the app.
--   * Row Level Security  -> enabled. This is what replaces the Express
--                            backend's `.eq('user_id', ...)` filters, and it
--                            is enforced by Postgres rather than app code.
--   * `profiles`          -> new. Holds the per-user encryption salt used by
--                            the on-device encryption added in Phase 5.

-- ---------------------------------------------------------------------------
-- Clean slate
-- ---------------------------------------------------------------------------

drop table if exists public.cards cascade;
drop table if exists public.profiles cascade;
drop table if exists public.users cascade;   -- hand-rolled auth table, now obsolete


-- ---------------------------------------------------------------------------
-- profiles — one row per account, created automatically on signup
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  key_salt   text,                                    -- set once, at wallet setup (Phase 5)
  created_at timestamptz not null default now()
);

comment on column public.profiles.key_salt is
  'Random per-user salt for PBKDF2 key derivation. Useless on its own — the '
  'wallet passphrase itself is never stored or transmitted.';

alter table public.profiles enable row level security;

create policy "own profile select" on public.profiles
  for select using (auth.uid() = id);

create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);


-- Create the profile row automatically whenever someone signs up, so the app
-- never has to handle a missing-profile case.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------

create table public.cards (
  id         uuid primary key default gen_random_uuid(),

  -- `default auth.uid()` means the app never sends user_id at all; Postgres
  -- fills it from the caller's session. Combined with the RLS policies below,
  -- there is no way for a client to write a row owned by someone else.
  user_id    uuid not null default auth.uid()
             references auth.users(id) on delete cascade,

  card_name  text not null check (length(trim(card_name)) > 0),
  card_type  text not null check (card_type in ('Debit', 'Credit', 'ID', 'Membership', 'Business')),
  card_color text,

  -- Debit / Credit
  last_four_digits      text check (last_four_digits ~ '^[0-9]{4}$'),
  card_holder_name      text,
  card_number_encrypted text,   -- genuine ciphertext from Phase 5 onward
  expiry_date           text,

  -- ID / Membership
  institution text,
  id_number   text,
  club_name   text,

  -- Business
  designation    text,
  phone          text,
  business_email text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.cards.card_number_encrypted is
  'XChaCha20-Poly1305 ciphertext, base64, nonce prepended. Encrypted on the '
  'device before upload — the server never sees the plaintext card number. '
  'Held plaintext by the pre-Phase-5 app despite the column name.';

create index cards_user_id_created_at_idx
  on public.cards (user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- Row Level Security — this is what replaces the Express backend
-- ---------------------------------------------------------------------------

alter table public.cards enable row level security;

create policy "own cards select" on public.cards
  for select using (auth.uid() = user_id);

create policy "own cards insert" on public.cards
  for insert with check (auth.uid() = user_id);

create policy "own cards update" on public.cards
  for update using (auth.uid() = user_id)
              with check (auth.uid() = user_id);

create policy "own cards delete" on public.cards
  for delete using (auth.uid() = user_id);


-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_touch_updated_at
  before update on public.cards
  for each row execute function public.touch_updated_at();
