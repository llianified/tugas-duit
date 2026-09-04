import { PAYOUT_PROOF_MAX_BYTES } from '@/domain/economy/withdrawal'

export interface PayoutProof {
  bytes: Uint8Array
  contentType: string
  fileName: string
}

type ProofResult =
  | { ok: true; proof: PayoutProof }
  | { ok: false; message: string }

function sniff(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) return 'image/png'
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export async function readPayoutProof(file: File): Promise<ProofResult> {
  if (file.size === 0) return { ok: false, message: 'Berkas buktinya kosong.' }
  if (file.size > PAYOUT_PROOF_MAX_BYTES) {
    return { ok: false, message: 'Bukti transfer maksimum 5 MB.' }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength > PAYOUT_PROOF_MAX_BYTES) {
    return { ok: false, message: 'Bukti transfer maksimum 5 MB.' }
  }

  const sniffed = sniff(bytes)
  if (!sniffed) {
    return { ok: false, message: 'Bukti transfer harus gambar JPEG, PNG, atau WebP.' }
  }
  if (file.type && file.type !== sniffed) {
    return { ok: false, message: 'Isi berkasnya tidak cocok dengan tipe gambarnya.' }
  }

  const extension = sniffed === 'image/jpeg' ? 'jpg' : sniffed === 'image/png' ? 'png' : 'webp'

  return {
    ok: true,
    proof: { bytes, contentType: sniffed, fileName: `bukti-transfer.${extension}` },
  }
}
