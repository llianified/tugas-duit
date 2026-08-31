/**
 * Ingatan satu bit: apakah iklan menyala saat terakhir app ini dibuka.
 *
 * Dipakai HANYA oleh kerangka pemuatan, untuk memutuskan menggambar satu tombol atau
 * dua di kartu task. Nilai sebenarnya tetap datang dari `/api/session`; ini bukan
 * sumber kebenaran dan tidak boleh dipakai untuk memutuskan apa pun yang berakibat —
 * user bisa mengubah localStorage-nya sendiri.
 *
 * Sengaja lewat atribut di `<html>`, bukan state React: sesi belum termuat saat
 * kerangka tergambar, dan membaca localStorage saat render akan membuat HTML server
 * berbeda dari klien. Script di `<head>` menyelesaikannya sebelum paint pertama,
 * sama seperti `THEME_INIT_SCRIPT`.
 *
 * Tanpa nilai tersimpan, atributnya tidak dipasang sama sekali dan kerangka tetap
 * menggambar dua tombol — bentuk yang benar untuk konfigurasi bawaan, dan satu-satunya
 * tebakan yang bisa diambil sebelum user pernah membuka app.
 */
export const ADS_HINT_STORAGE_KEY = 'tugas-duit-ads'

export const ADS_HINT_INIT_SCRIPT = `try{var a=localStorage.getItem('${ADS_HINT_STORAGE_KEY}');if(a==='on'||a==='off')document.documentElement.dataset.adsHint=a}catch(e){}`

export function rememberAdsHint(enabled: boolean): void {
  try {
    window.localStorage.setItem(ADS_HINT_STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Mode privat atau storage penuh: kerangka cukup memakai tebakan bawaannya.
  }
}
