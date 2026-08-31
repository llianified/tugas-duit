import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Skala font kustom repo (`--text-meta`, `--text-label`, `--text-cta` di
 * `app/globals.css`) tidak dikenal tailwind-merge secara default, sehingga
 * `text-meta` dianggap kelas warna dan dibuang ketika argumen lain memakai
 * `text-*` warna. Registrasikan namespace `text` agar font-size dan warna
 * teks tidak saling menimpa.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['meta', 'label', 'cta'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
