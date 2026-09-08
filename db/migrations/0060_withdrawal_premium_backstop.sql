-- Kode baru belum live saat migrasi ini terpasang. Backstop DB menutup jendela deploy agar runtime
-- lama tidak bisa menerima atau menyelesaikan withdrawal non-Premium ketika cleanup berjalan.
create function withdrawals_guard_premium() returns trigger as $$
declare
  premium_active boolean;
begin
  perform 1 from economy_config where id = 1 for key share;
  if not coalesce((select (config ->> 'withdrawalRequiresPremium')::int > 0
                     from economy_config where id = 1), false) then
    return new;
  end if;

  if tg_op = 'INSERT' and new.state <> 'processing' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.state = new.state then
    return new;
  end if;

  select premium_until > now()
    into premium_active
    from users
   where id = new.user_id
   for update;

  if not coalesce(premium_active, false) then
    raise exception using
      errcode = 'P0001',
      constraint = 'withdrawals_premium_required',
      message = 'Premium aktif wajib sampai withdrawal selesai';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger withdrawals_require_premium
  before insert or update of state on withdrawals
  for each row execute function withdrawals_guard_premium();
