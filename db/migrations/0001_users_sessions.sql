create extension if not exists pgcrypto;

create table users (
  id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid() unique,
  telegram_id bigint not null unique,
  username text,
  first_name text not null default '',
  last_name text,
  photo_url text,
  language_code text,
  is_premium boolean not null default false,
  balance_credits bigint not null default 0,
  referral_code text not null unique,
  referred_by bigint references users(id) on delete set null,
  banned_at timestamptz,
  ban_reason text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_no_self_referral check (referred_by is null or referred_by <> id),
  -- Diberi nama, bukan check inline anonim: ini jaring terakhir saldo, dan nama
  -- constraint-nya yang muncul di pesan error Postgres saat ada kode yang mencoba
  -- mengurangi saldo di bawah nol.
  constraint users_balance_non_negative check (balance_credits >= 0)
);
create index users_referred_by_idx on users(referred_by) where referred_by is not null;

create table sessions (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text,
  revoked_at timestamptz
);
create index sessions_user_id_idx on sessions(user_id);
create index sessions_expires_at_idx on sessions(expires_at);
