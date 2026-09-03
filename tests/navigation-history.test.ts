import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `useViewStack` adalah hook yang bicara langsung dengan `window.history`, dan repo
 * ini tidak punya renderer React maupun DOM di devDependencies — seluruh 61 berkas
 * uji lainnya menguji modul `.ts` di `domain/` dan `server/`. Jadi yang dijaga di
 * sini bentuk kodenya, bukan perilakunya saat dijalankan: pemindaian sumber,
 * idiom yang sama dengan `tests/architecture.test.ts` dan `RL-2`.
 *
 * Yang ditahan: `select()` (nav pill) sempat memakai `replaceState` saat kedalaman
 * tumpukan > 1, dan itu MENIMPA entri riwayat yang sedang ditempati user. Dari
 * Beranda → Riwayat → Profil lalu menekan "Peringkat", entri Profil hilang
 * tertimpa, jadi tombol Back mendarat di Riwayat — melompati view yang barusan
 * ditinggalkan. `pushState` mengembalikan arti Back yang benar: satu tekan sama
 * dengan satu view mundur.
 *
 * Yang TIDAK dijaga di sini, dan disebutkan supaya tidak disangka sudah tertutup:
 * perilaku `popstate` sungguhan, dan interaksinya dengan entri penjaga Telegram.
 * Keduanya butuh DOM.
 */

const SOURCE = path.resolve(import.meta.dirname, '..', 'navigation/use-view-stack.ts')

function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`const ${name} = useCallback(`)
  expect(start, `callback ${name} tidak ditemukan`).toBeGreaterThan(-1)
  const end = source.indexOf('\n  )', start)
  return source.slice(start, end)
}

describe('NAV-1 — nav pill menambah entri riwayat, tidak menimpanya', () => {
  it('select() memakai pushState dan tidak pernah replaceState', async () => {
    const select = bodyOf(await readFile(SOURCE, 'utf8'), 'select')

    expect(select).toContain('window.history.pushState')
    expect(select).not.toContain('replaceState')
  })

  it('select() tetap meratakan tumpukan ke Beranda plus satu tujuan', async () => {
    const select = bodyOf(await readFile(SOURCE, 'utf8'), 'select')

    // Kedalaman, tombol back Telegram, dan `goBack()` bersandar pada bentuk ini.
    expect(select).toContain('view === ROOT_VIEW ? [ROOT_VIEW] : [ROOT_VIEW, view]')
  })

  it('push() untuk subview tetap menambah tingkat, bukan meratakan', async () => {
    const push = bodyOf(await readFile(SOURCE, 'utf8'), 'push')

    expect(push).toContain('[...current, view]')
    expect(push).toContain('window.history.pushState')
  })
})
