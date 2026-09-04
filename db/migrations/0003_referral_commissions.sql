create table referral_commissions (
  id bigint generated always as identity primary key,
  upline_id bigint not null references users(id) on delete cascade,
  downline_id bigint not null references users(id) on delete cascade,
  task_completion_id bigint not null references task_completions(id) on delete cascade unique,
  reward integer not null,
  commission_units integer not null check (commission_units > 0),
  settled_ledger_id bigint references credit_ledger(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint referral_commissions_no_self check (upline_id <> downline_id)
);
create index referral_commissions_upline_idx on referral_commissions(upline_id, created_at desc);
create table referral_wallets (
  user_id bigint primary key references users(id) on delete cascade,
  pending_units integer not null default 0 check (pending_units between 0 and 99),
  updated_at timestamptz not null default now()
);
create table referral_clicks (
  id bigint generated always as identity primary key,
  code text not null,
  ip_hash bytea,
  created_at timestamptz not null default now()
);
create index referral_clicks_code_idx on referral_clicks(code, created_at desc);
