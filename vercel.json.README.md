# Catatan untuk `vercel.json`

Catatan ini ada di file terpisah karena `vercel.json` divalidasi ketat terhadap
schema `https://openapi.vercel.sh/vercel.json`, yang memakai
`additionalProperties: false`. Menambahkan key komentar (misalnya `"//"`) di
dalamnya akan membuat build gagal dengan error
`should NOT have additional property`. Jadi jangan taruh komentar di dalam JSON-nya.

## `git.deploymentEnabled: false` — SENGAJA, JANGAN DIHAPUS

```json
"git": {
  "deploymentEnabled": false
}
```

**Kenapa:** auto-deploy dari Git bikin kuota deployment cepat habis. Pernah kena
limit 100 deployment/hari gara-gara tiap push men-trigger build. Dengan setting
ini, push ke `master` (atau branch mana pun) **tidak** akan membuat deployment
baru sama sekali.

**Konsekuensi:** merge PR = kode masuk ke repo, tapi **app yang live tidak berubah**.
Kalau tampilan terasa "gak update padahal udah merge", ini biasanya penyebabnya.

## Cara deploy waktu memang mau rilis

Pilih salah satu:

- **Vercel Dashboard** → project → Deployments → **Redeploy** pada commit terbaru.
- **Vercel CLI**:
  ```bash
  vercel --prod
  ```
- **v0** → tombol **Publish** di kanan atas.

## Kalau nanti mau nyalakan auto-deploy lagi

Hapus blok `git` dari `vercel.json`, atau ubah jadi:

```json
"git": {
  "deploymentEnabled": {
    "master": true
  }
}
```

Bentuk per-branch di atas lebih hemat: cuma `master` yang deploy, push ke branch
kerja tidak membakar kuota.
