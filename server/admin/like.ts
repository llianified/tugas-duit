/** Escape wildcard `LIKE`/`ILIKE` di sisi SQL, bukan di TypeScript: parameternya dipakai ulang oleh klausa lain di query yang sama (`upper(referral_code)=upper($1)` di `admin-users.ts`), jadi meng-escape nilainya sebelum dikirim akan merusak pembandingan yang bukan `LIKE`. Urutannya wajib backslash lebih dulu — meng-escape `%` sebelum `\` akan meng-escape ulang backslash yang baru saja ditulis. Berdiri sebagai satu fungsi karena dua pencarian admin sempat berbeda: `searchAdminUsers` meng-escape, `readPayoutHistory` tidak, sehingga `%` yang diketik admin di kolom pencarian riwayat payout mencocokkan seluruh baris. */
export function likeEscaped(parameter: string): string {
  return `replace(replace(replace(${parameter},'\\','\\\\'),'%','\\%'),'_','\\_')`
}
