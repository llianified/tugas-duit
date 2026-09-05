'use client'

import { TokenMark } from '@/shared/components/token-mark'
import type { SplashPhase } from '@/shell/use-boot-splash'

/** Layar pembuka selama sesi belum terbaca. Ia menempati jeda yang memang sudah ada di Mini App
 * Telegram — `initData` baru sampai setelah webview-nya berdiri — jadi yang digantikannya bukan
 * layar kosong melainkan kerangka abu-abu yang tidak mengatakan apa pun.
 *
 * Di sinilah denyut lambangnya tinggal, dan hanya di sini. Di tempat lain lambang TD berdiri di
 * samping setiap nominal; menganimasikannya di sana berarti seluruh layar berdenyut serentak,
 * karena animasi CSS pada elemen sejenis mulai bersamaan. Di splash ia satu-satunya di layar,
 * besar, dan tidak bersaing dengan apa pun — satu-satunya tempat yang bentuknya memang untuk itu.
 *
 * Ukurannya diatur lewat `font-size` induknya, bukan lewat kelas tinggi/lebar di `TokenMark`:
 * lambangnya sudah berukuran `em`, jadi menaikkan `font-size` membesarkannya utuh tanpa ada dua
 * sumber kebenaran soal rasionya. */
export function BootSplash({ phase }: { phase: SplashPhase }) {
  if (phase === 'gone') return null

  return (
    <div className="boot-splash" data-phase={phase} role="status" aria-label="Menyiapkan aplikasi">
      <div className="boot-splash-stack">
        <span className="token-beat text-[7.5rem] leading-none text-foreground">
          <TokenMark />
        </span>
        <span className="boot-splash-track">
          <span className="boot-splash-fill" />
        </span>
      </div>
    </div>
  )
}
