create type withdrawal_state as enum ('processing', 'paid', 'rejected');
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete restrict,
  channel_id text not null,
  account_number text not null,
  account_name text not null,
  credits integer not null check (credits >= 100),
  amount_idr integer not null check (amount_idr = credits * 100),
  state withdrawal_state not null default 'processing',
  hold_ledger_id bigint not null references credit_ledger(id) on delete restrict,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  rejected_at timestamptz,
  reject_reason text,
  processed_by bigint references users(id) on delete set null,
  admin_note text,
  constraint withdrawals_state_consistent check (
    (state = 'processing' and paid_at is null and rejected_at is null) or
    (state = 'paid' and paid_at is not null) or
    (state = 'rejected' and rejected_at is not null)
  )
);
create index withdrawals_user_idx on withdrawals(user_id, requested_at desc);
create index withdrawals_pending_idx on withdrawals(requested_at) where state = 'processing';
create unique index withdrawals_one_active_per_user on withdrawals(user_id) where state = 'processing';
