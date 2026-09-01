const TOKEN = process.env.BOT_TOKEN
const CHAT = '@tugasduit'
const API = `https://api.telegram.org/bot${TOKEN}`
const APP_URL = 'https://t.me/tugasduit_bot/app'

async function send(text, extra = {}) {
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT,
      text,
      parse_mode: 'HTML',
      disable_notification: true,
      link_preview_options: { is_disabled: true },
      ...extra,
    }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(JSON.stringify(json))
  return json.result.message_id
}

const posts = [
  {
    slug: 'Apa itu Tugas Duit',
    text: `<b>Tugas Duit — apa sih ini?</b>

Singkatnya: kamu kerjain task kecil di dalam Telegram, dapat credit, credit-nya bisa dicairin jadi rupiah.

Nggak ada modal, nggak ada deposit, nggak ada "undang 10 orang dulu baru bisa main". Buka app-nya, kerjain task, saldo naik.

• 1 credit = Rp100
• Satu task cuma butuh beberapa detik
• Minimum penarikan Rp10.000

Channel ini isinya info resmi doang: update fitur, pengumuman, aturan main. Post paling bawah ada daftar isi + FAQ, mampir situ kalau bingung.`,
  },
  {
    slug: 'Cara mainnya',
    text: `<b>Cara mainnya</b>

Ada 3 jenis task:

• <b>Ketik</b> — salin teks yang muncul di layar
• <b>Hitung</b> — jawab soal hitungan sederhana
• <b>Pilih bentuk</b> — klik bentuk yang diminta

Tingkat kesulitannya Easy, Medium, Hard. Makin susah, makin gede rewardnya.

Tiap task dikasih 3 kali percobaan dan waktu 5 menit. Jadi salah ketik sekali nggak langsung hangus, santai.`,
  },
  {
    slug: 'Bintang dan reward',
    text: `<b>Bintang: kenapa ngebut itu penting</b>

Tiap task dinilai 1–3 bintang, dasarnya kecepatan kamu.

• <b>3 bintang</b> — selesai di dalam waktu par
• <b>2 bintang</b> — selesai di dalam 2× waktu par
• <b>1 bintang</b> — lebih lama dari itu

Waktu par: Easy 10 detik, Medium 18 detik, Hard 28 detik.

Rewardnya (credit, urutannya 1 / 2 / 3 bintang):

• Easy — 1 / 2 / 3
• Medium — 2 / 3 / 5
• Hard — 3 / 6 / 9

Artinya Hard 3 bintang = 9 credit = Rp900, sementara Easy 1 bintang cuma Rp100. Selisihnya 9 kali. Jadi ya, cepat itu kebayar.`,
  },
  {
    slug: 'Energi dan stok reward',
    text: `<b>Energi &amp; stok reward</b>

<b>Energi</b>
1 task makan 1 energi. Maksimal 5, isi ulang 1 tiap 45 menit.
Energi habis tapi masih pengen main? Tonton 1 iklan, dapat pass 10 menit buat lanjut tanpa energi. Maksimal 30 iklan sehari, jeda 40 detik antar iklan.

<b>Stok reward</b>
Ini plafon penghasilan kamu. Kapasitasnya 300 credit (Rp30.000) dan ngisi 1 credit tiap 5 menit.

Task tetap kehitung walau stok kosong, tapi yang dibayar cuma sebanyak stok yang tersisa. Makanya mampir beberapa kali sehari lebih untung daripada digas 3 jam nonstop terus mentok.

Kapasitas stok ini naik kalau rank kamu naik dan streak harian jalan.`,
  },
  {
    slug: 'Rank, misi, papan peringkat',
    text: `<b>Rank, misi harian, papan peringkat</b>

<b>Rank</b> — naik dari total task yang kamu selesaikan:

• Apprentice — 0 task
• Artisan — 100 task
• Expert — 300 task
• Virtuoso — 700 task
• Luminary — 1.500 task

Tiap naik rank, kapasitas stok reward kamu nambah.

<b>Misi harian</b> — hadiahnya <b>energi</b>, bukan credit:

• Selesaikan 5 task → 2 energi
• Dapat 3 task bintang tiga → 2 energi
• Tonton 3 iklan → 3 energi

<b>Papan peringkat</b> — aktif, jadi kelihatan siapa yang paling rajin.`,
  },
  {
    slug: 'Cairin saldo',
    text: `<b>Cairin saldo</b>

• Minimum penarikan <b>Rp10.000</b> (100 credit)
• Tujuan: <b>DANA, GoPay, OVO, BCA</b>
• Dana masuk paling lama <b>1×24 jam kerja</b>
• Jeda antar penarikan 7 hari (premium 3 hari)

Nama pemilik rekening harus sama dengan yang kamu tulis di form. Salah nomor atau salah nama = ditolak, jadi cek dua kali sebelum kirim ya.

Semua penarikan yang udah dibayar ada riwayatnya di app, lengkap sama bukti transfernya.`,
  },
  {
    slug: 'Ajak temen, dapat 10%',
    text: `<b>Ajak temen, dapat 10%</b>

Tiap task yang diselesaikan temen yang kamu ajak, kamu dapat komisi 10% dari rewardnya.

Komisinya dari sistem, bukan dipotong dari saldo dia — jadi dia nggak kehilangan apa pun.

• Jalan terus selama dia main, bukan bonus sekali doang
• Maksimal Rp10.000 komisi per hari
• Link referral kamu ada di app, menu Referral

Bonus join channel ini juga ada: 50 credit (Rp5.000), sekali.`,
  },
  {
    slug: 'Premium',
    text: `<b>Premium — buat yang niat seriusan</b>

• Energi 10 (dari 5), isi tiap 20 menit (dari 45)
• Kapasitas stok reward +50 credit
• Iklan yang muncul sendiri dimatiin total
• Bisa cair tiap 3 hari (dari 7)
• Batas task harian 800 (dari 400)
• Mahkota emas di papan peringkat, kelihatan semua orang

Harganya:
• Rp19.900 — 1 bulan
• Rp34.900 — 2 bulan
• Rp44.900 — 3 bulan

Catatan jujur: tombol "nonton iklan" tetep ada walau premium, karena itu yang nambah jatah task kamu. Yang mati cuma iklan yang nongol sendiri. Jadi premium bukan berarti nol iklan.`,
  },
]

const ids = []
for (const post of posts) {
  const id = await send(post.text)
  ids.push({ ...post, id })
  console.log(`sent ${post.slug} -> ${id}`)
  await new Promise((r) => setTimeout(r, 1500))
}

const toc = ids
  .map((p, i) => `${i + 1}. <a href="https://t.me/tugasduit/${p.id}">${p.slug}</a>`)
  .join('\n')

const faq = `<b>FAQ + daftar isi</b>

<b>Ini beneran bayar?</b>
Iya. Minimum Rp10.000, ke DANA/GoPay/OVO/BCA, paling lama 1×24 jam kerja. Riwayat pembayaran ada di app lengkap sama buktinya.

<b>Perlu deposit atau bayar dulu?</b>
Nggak, dan selamanya nggak. Kalau ada yang minta deposit atas nama Tugas Duit, itu penipu — bukan kami.

<b>Kok rewardnya kecil?</b>
Karena ini task beberapa detik, bukan kerjaan. Anggap aja uang jajan dari waktu nunggu, bukan gaji bulanan.

<b>Task saya selesai tapi saldo nggak nambah?</b>
Stok reward kamu kosong. Dia ngisi 1 credit tiap 5 menit, jadi balik lagi nanti dan lanjut.

<b>Energi habis, harus nunggu 45 menit?</b>
Nggak harus. Tonton 1 iklan, dapat pass 10 menit buat main tanpa energi.

<b>Gimana caranya dapat lebih banyak?</b>
Ngebut biar dapat 3 bintang, ambil task Hard, klaim misi harian, terus ajak temen buat komisi 10%.

<b>Boleh punya 2 akun?</b>
Jangan. Multi-akun kebaca dan saldonya hangus. Nggak worth it.

<b>Ada yang DM ngaku admin?</b>
Abaikan. Admin nggak pernah DM duluan dan nggak pernah minta OTP, PIN, atau password.

<b>Daftar isi channel</b>
${toc}

Ada yang belum kejawab? Tulis di komentar.`

const res = await fetch(`${API}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT,
    text: faq,
    parse_mode: 'HTML',
    disable_notification: true,
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [[{ text: 'Buka Tugas Duit', url: APP_URL }]],
    },
  }),
})
const json = await res.json()
if (!json.ok) throw new Error(JSON.stringify(json))
console.log(`sent FAQ -> ${json.result.message_id}`)
