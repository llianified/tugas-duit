import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/**',
                '@/shared/**',
                '@/shell/**',
                '@/server/**',
                '@/app/**',
                '@/navigation/**',
                '../features/**',
                '../shared/**',
                '../shell/**',
                '../server/**',
                '../app/**',
                '../navigation/**',
              ],
              message: 'Domain harus murni dan hanya boleh bergantung pada modul domain lain.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/**', '@/shell/**', '@/server/**', '@/app/**'],
              message: 'Shared tidak boleh bergantung pada layer aplikasi yang lebih tinggi.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['features/**/*.{ts,tsx}', 'shell/**/*.{ts,tsx}', 'navigation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/**', '@/app/**'],
              message: 'Kode UI tidak boleh mengimpor implementasi server atau route aplikasi.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/**', '@/shell/**', '@/navigation/**', '@/app/**'],
              message: 'Server hanya boleh bergantung pada domain dan utilitas shared yang netral.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
