create type captcha_type as enum ('text', 'math', 'select');
create type difficulty as enum ('Easy', 'Medium', 'Hard');
create type ledger_kind as enum ('task', 'commission', 'withdrawal_hold', 'withdrawal_refund', 'adjustment');

create table challenges (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  type captcha_type not null,
  difficulty difficulty not null,
  payload jsonb not null,
  answer_hash bytea not null,
  max_reward integer not null check (max_reward > 0),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  solved boolean not null default false
);
create unique index challenges_one_active_per_user on challenges(user_id) where submitted_at is null;
create index challenges_expires_at_idx on challenges(expires_at) where submitted_at is null;

create table task_completions (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  challenge_id uuid not null references challenges(id) on delete restrict unique,
  type captcha_type not null,
  difficulty difficulty not null,
  elapsed_ms integer not null check (elapsed_ms >= 0),
  stars smallint not null check (stars between 1 and 3),
  reward integer not null check (reward > 0),
  completed_at timestamptz not null default now()
);
create index task_completions_user_completed_idx on task_completions(user_id, completed_at desc);

create table credit_ledger (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete restrict,
  kind ledger_kind not null,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  idempotency_key text not null unique,
  reference_id text,
  note text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created_idx on credit_ledger(user_id, created_at desc);
create index credit_ledger_user_kind_idx on credit_ledger(user_id, kind);
create function credit_ledger_append_only() returns trigger as $$ begin raise exception 'credit_ledger bersifat append-only'; end; $$ language plpgsql;
create trigger credit_ledger_no_update before update or delete on credit_ledger for each row execute function credit_ledger_append_only();
