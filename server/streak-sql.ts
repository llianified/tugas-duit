export const STREAK_EXPRESSION = `coalesce(
  -- Baris pertama yang tidak lagi jatuh tepat 'rn - 1' hari sebelum hari ini
  -- adalah tempat rentetannya putus; kalau tidak ada yang putus, seluruh daftar
  -- adalah rentetannya.
  (select min(rn) - 1 from ordered where day <> (select day from today) - (rn - 1)),
  (select count(*) from ordered)
)::int`
