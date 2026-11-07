# BukuCeritaQ — Konsep & Keputusan Desain

Sumber utama: `Daftar Rempah-Rempah di Indonesia.pdf` (transcript Gemini, 7 halaman, 4 gambar konsep).
Keputusan desain dikunci bersama Mas-sama pada sesi kickoff (lihat §4).

## 1. Identitas seri

**Judul seri:** Petualangan Adab Qila & Ezra

Buku cerita anak (board-book style) untuk balita **2–5 tahun**, berbahasa Indonesia,
bertema **adab & etika Islam + budaya Indonesia modern**. Satu buku = **satu konsep adab**,
**12 halaman** (judul + 10 halaman isi full content + penutup), terbit **incremental** (banyak buku kecil, bukan satu buku tebal).

Tagline resmi: *"Pintar Beretika, Santun Berbudaya"*

## 2. Tokoh

| Tokoh | Karakter | Penampilan standar |
|-------|----------|--------------------|
| **Qila** | Kakak perempuan, pintar, cerewet, penyayang adik, berjiwa pemimpin. Menjelaskan adab dengan hangat. | Hijab pink muda + gamis batik merah muda bermotif emas, sepatu pink, bunga kecil di hijab. Pose andalan: senyum hangat, menjelaskan, menunjuk. |
| **Ezra** | Adik laki-laki, polos, ramah, penuh rasa ingin tahu, suka tersenyum. Melempar pertanyaan polos. | Peci hitam, koko biru muda bermotif halus, celana biru tua, sandal. Pose andalan: salam (menangkup tangan), penasaran, senyum. |
| **Dalang (Mas-sama)** | Narator buku di luar gambar. Penyimpul **Box Hikmah** di setiap akhir cerita. | Tidak tampil visual; hadir sebagai teks pengantar & catatan hikmah. |

Dinamika cerita: dialog **ping-pong** Qila ↔ Ezra. Ezra bertanya (mewakili anak pembaca),
Qila menjelaskan dengan cara seru dan tidak menggurui.

> Catatan visual: untuk seri **video Rempah**, Qila & Ezra mengenakan busana Nusantara
> (blangkon/destar, batik penuh) di panggung wayang. Seri **storybook Adab** memakai
> busana muslimah/muslim di atas. Dua varian busana, wajah & proporsi karakter **sama**.

## 3. Sistem visual (style anchor)

**Anchor:** `research/contoh-bab1.png` — halaman storybook painterly "Petualangan Adab Qila & Ezra".

Genre: **storybook painterly illustration** (soft painterly cartoon, detail kaya, lembut & hangat)
dengan aksen Nusantara — bingkai kayu ukir, pita batik, kotak perkamen, "Pesan Ki Dalang".
Cerah, ramah balita, tidak gelap/dramatis. (Varian papercraft lama tidak dipakai lagi untuk storybook.)

### Palet warna

| Token | Hex | Pemakaian |
|-------|-----|-----------|
| `sky` | `#E0F2FE` | Latar langit, background utama |
| `sunshine` | `#FEF08A` | Aksen kuning hangat, highlight |
| `leaf` | `#22C55E` | Alam, dedaunan, hijau segar |
| `orange` | `#F97316` | Aksen ceria, judul |
| `pink` | `#EC4899` | Batik pink, identitas Qila |
| `slate` | `#1E293B` | Teks & outline |
| `gold` | `#D4A017` | Bingkai kayu ukir, ornamen |
| `cream` | `#FFF8E7` | Kertas kelir, panel hikmah |

### Tipografi

| Peran | Font | Ukuran |
|-------|------|--------|
| Judul / sampul | Fredoka One (atau Sniglet) | 48–72px, outline tebal |
| Dialog balon kata | Nunito Bold / Poppins | 18–22px |
| Narasi / Box Hikmah | Nunito Regular | 14–16px |

### Ornamen berulang (wajib konsisten antar buku)

- Motif awan **Mega Mendung** pastel
- **Bingkai kayu ukir gold** di sampul
- Pendar cahaya **blencong** lembut (warm glow)
- Bintang/sparkles kecil, bunga frangipani
- Latar Nusantara: sawah terasering, rumah tradisional, pegunungan tropis

## 4. Keputusan kickoff (dikunci)

| # | Keputusan | Pilihan |
|---|-----------|---------|
| 1 | Posisi repo | **Pipeline produksi standalone** di BukuCeritaQ. Integrasi RumaQ plugin menyusul. |
| 2 | Tema buku pertama | **Adab Qila & Ezra** |
| 3 | Format output | **PDF cetak + web reader dengan audio narasi** |
| 4 | Strategi aset | **Library SVG** karakter/prop (dibuat sekali) + **AI untuk latar adegan** |
| 5 | Spek buku | **12 halaman (judul + 10 isi + penutup), usia 2–5 th, 1 konsep per buku**, seri incremental banyak buku |
| 6 | Audio | Web dengan narasi audio bagus; **TTS MiMo dulu**, ElevenLabs starter bila perlu |
| 7 | Provider AI | **Agnostik** (adapter), default API berbayar murah; biaya per buku dicatat & dibatasi |
| 8 | Sumber topik | **Agen mengusulkan katalog** adab → user memilih/mengurutkan → agen memproduksi berulang |
| 9 | Bahasa | **Indonesia saja** |

## 5. Tiga pilar konten (dari PDF)

1. **Adab di rumah & keluarga** — birrul walidain, kasih sayang kakak-adik,
   Bismillah / Alhamdulillah / Afwan / Jazakallah khair.
2. **Etika di ruang publik & sekolah** — antre, tidak memotong pembicaraan,
   menghargai perbedaan, kebersihan (bagian dari iman), gotong royong.
3. **Adab digital & wawasan global** — gadget bijak & jujur, santun dengan
   warga dunia berbagai bangsa dan budaya.

## 6. Anatomi halaman buku

Setiap halaman punya:

- **Balon kata (speech bubble)** dialog Qila / Ezra — sedikit kata, besar & jelas
- **Ilustrasi adegan** (background + karakter SVG dari library + prop)
- **Box Hikmah Dalang** (di halaman penutup / sebagian halaman) — catatan hangat
  dari Dalang, boleh memuat adab/doa pendek yang autentik

Struktur beat sheet 12 halaman (judul + 10 isi + penutup) ada di `docs/PLAN.md` (berdasar riset
toddler-book best practice).

## 7. Referensi gambar (repo ini)

| File | Isi |
|------|-----|
| `research/page7_0_X26.jpg` | **Sampul storybook Adab** — style anchor utama |
| `research/page6_0_X23.jpg` | Varian wayang panggung (referensi busana Nusantara) |
| `research/page2_0_X13.jpg` | Varian kids-friendly video Rempah (maskot rempah) |
| `research/page1_0_X7.jpg` | Varian gelap dramatis video — TIDAK untuk storybook |
