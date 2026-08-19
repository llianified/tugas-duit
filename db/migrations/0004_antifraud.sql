create table rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key(bucket, window_start)
);
create index rate_limits_window_idx on rate_limits(window_start);
create table fraud_signals (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  signal text not null,
  severity smallint not null check (severity between 1 and 5),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index fraud_signals_user_idx on fraud_signals(user_id, created_at desc);
create table daily_quotas (
  user_id bigint not null references users(id) on delete cascade,
  quota_date date not null,
  tasks_completed integer not null default 0,
  credits_earned integer not null default 0,
  primary key(user_id, quota_date)
);
