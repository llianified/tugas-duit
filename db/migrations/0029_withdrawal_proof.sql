alter table withdrawals
  add column proof_file_id text,
  add column proof_sent_at timestamptz;

alter table withdrawals add constraint withdrawals_proof_only_when_paid check (
  (proof_file_id is null and proof_sent_at is null) or
  (proof_file_id is not null and proof_sent_at is not null and state = 'paid')
);
