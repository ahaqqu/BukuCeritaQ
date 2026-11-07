# BukuCeritaQ — Arsitektur Pipeline & Rencana

Status: draft untuk review Mas-sama · 2026-11-07
Baca dulu: [`CONCEPT.md`](CONCEPT.md) — keputusan desain yang sudah dikunci.

## 0. Sasaran

Satu pipeline **agentic** yang bisa memproduksi buku cerita balita **berulang kali** dengan:

1. **Konsisten** — karakter, palet, tipografi, dan struktur cerita sama di setiap buku.
2. **Berkualitas** — sesuai standar buku balita (riset §5) + guardrail konten Islam (§6).
3. **Biaya terkontrol** — target **< $2 / buku** semua termasuk; aset dasar dibayar sekali.

Bukan satu buku tebal, tapi **seri incremental**: satu buku = satu konsep adab, 12 halaman (judul + 10 isi + penutup).

## 1. Bentuk repo (pipeline standalone)

`C:\Fun\Projects\BukuCeritaQ` adalah **repo produksi konten & aset** (mirip posisi
RumaQ-pipeline terhadap RumaQ). Integrasi ke RumaQ sebagai plugin "buku cerita"
adalah **fase berikutnya** dan tidak menghalangi pipeline ini bekerja mandiri.

```
BukuCeritaQ/
├── assets/                       # ASET KUNCI KONSISTENSI (dibayar sekali)
│   ├── characters/qila/          # pose PNG transparan + spec
│   ├── characters/ezra/
│   ├── props/                    # balon kata, panel hikmah, bunga, dll
│   ├── frames/                   # bingkai kayu ukir, awan mega mendung
│   ├── backgrounds/              # latar AI (di-cache, bisa dipakai ulang)
│   └── fonts/                    # Fredoka One, Nunito
├── topics/
│   └── catalog.yaml              # katalog 24 topik (agen usulkan → user pilih)
├── books/<slug>/                 # SATU BUKU = SATU FOLDER
│   ├── story.json                # naskah terstruktur (sumber kebenaran tunggal)
│   ├── backgrounds/              # latar khusus buku ini (kalau perlu)
│   ├── audio/                    # narasi per halaman (mp3)
│   ├── pages/                    # render halaman (png/webp)
│   ├── book.pdf                  # output cetak
│   ├── web/                      # output digital (reader + aset)
│   └── cost-log.jsonl            # jejak biaya buku ini
├── templates/
│   ├── page/                     # template HTML/SVG per layout_type
│   └── reader/                   # web reader statis
├── src/
│   ├── story/                    # adapter LLM: topik → story.json
│   ├── assets/                   # resolusi aset + generator latar
│   ├── audio/                    # adapter TTS
│   ├── render/                   # halaman → PNG/PDF/web
│   ├── budget/                   # cap biaya + cost-log
│   ├── qa/                       # checklist otomatis (guardrail §6)
│   └── cli.ts                    # CLI tunggal
├── config/
│   ├── style-guide.yaml          # palet, font, karakter (sumber gaya)
│   ├── providers.yaml            # konfigurasi provider AI (agnostik)
│   ├── voices.json               # mapping speaker → voice
│   └── budget.default.yaml       # cap biaya default per buku
└── docs/
    ├── CONCEPT.md
    └── PLAN.md                   # dokumen ini
```

## 2. Alur pipeline (satu buku)

```
[1] TOPIC        user pilih slug dari topics/catalog.yaml
        ↓
[2] STORY        LLM adapter → books/<slug>/story.json
                 validasi skema + guardrail konten (qa/)
        ↓
[3] ASSETS       resolusi: karakter/prop dari library (gratis)
                 latar: cek cache → kalau belum ada, image API (berbayar)
        ↓
[4] AUDIO        TTS adapter → audio/ per halaman (per speaker)
        ↓
[5] RENDER       template + story.json + aset →
                 pages/*.png + book.pdf (cetak) + web/ (digital)
        ↓
[6] QA           checklist otomatis + review manusia (ceklist §6)
        ↓
[7] PUBLISH      folder books/<slug>/ siap dibagikan
```

Setiap tahap **idempotent & bisa di-resume** (state di `story.json` + cost-log).
`--dry-run` di [3]/[4]/[5] mencetak rencana panggilan API + estimasi biaya tanpa belanja.

## 3. Stack teknologi (keputusan + alasan)

| Lapis | Pilihan utama | Fallback | Alasan |
|-------|---------------|----------|--------|
| Runtime | **Node.js + TypeScript** (bun/npm) | — | Tooling Playwright & ekosistem tipe sudah ada |
| Render halaman | **HTML/CSS + SVG inline → Playwright `page.pdf()`** | svg-to-pdfkit | Satu sumber HTML untuk PDF *dan* web (tidak drift); kontrol tipografi penuh |
| Cetak | PDF RGB + post-process CMYK (Ghostscript) bila cetak offset | cetak digital RGB | Chromium hanya RGB |
| Web reader | **1 file `reader.html` + `book.json` + gambar halaman + mp3** | HTML single-file base64 | Ringan, offline, tap besar untuk balita |
| TTS | **`edge-tts`** (gratis, `id-ID-ArdiNeural` / `id-ID-GadisNeural`) | **ElevenLabs** Starter ($5/bln, 30 mnt) | MiMo TTS tersedia via tool desktop untuk asset one-off; pipeline butuh engine CLI → edge-tts default, ElevenLabs saat perlu kualitas/voice clone — lihat `docs/TTS.md` |
| Gambar latar | **Gemini Nano Banana** (~$0.03/gambar) | OpenAI `gpt-image-2` / lokal SDXL | Reference-image conditioning bawaan → konsistensi gaya |
| LLM naskah | Adapter: default model murah (Gemini Flash / dsb.) | apa pun via `providers.yaml` | Naskah 10 halaman balita = < 2k token |

### Kenapa bukan alternatif lain

- **`react-pdf` ditolak**: tidak pakai CSS penuh, layout ditulis ulang, buruk untuk
  komposisi adegan SVG.
- **Microservice / DB ditolak untuk sekarang**: repo ini pipeline konten, bukan service.
  File-based + git cukup; RumaQ plugin menyusul.

## 4. Desain untuk konsistensi (pilar #1)

Konsistensi dijaga oleh **4 kunci**, bukan oleh "semoga AI-nya mirip":

1. **`config/style-guide.yaml`** — satu sumber kebenaran: palet hex, font, deskripsi
   karakter (Qila/Ezra), ornamen wajib. Semua prompt & template membaca file ini.
2. **Library aset fisik** (`assets/characters|props|frames`) — dibuat **sekali**,
   dipakai di semua buku. Karakter TIDAK di-generate ulang per halaman.
   - Pose standar Qila: `smile`, `explain`, `wave`, `point`, `proud`, `sit`
   - Pose standar Ezra: `curious`, `smile`, `salam`, `try`, `laugh`, `sit`
   - Ornamen: `frame_kayu`, `cloud_megamendung`, `bubble_a`, `bubble_b`, `hikmah_box`
3. **`story.json` + `style_lock`** — setiap buku menyimpan hash referensi gaya, palet,
   dan seed. Halaman wajib merujuk ID aset library, bukan deskripsi bebas.
4. **Buku emas referensi** (`books/adab-salam/`) — buku pertama jadi patokan visual
   & naratif untuk buku-buku berikutnya.

### Konsistensi aset AI (hanya untuk latar)

Setiap panggilan image API selalu membawa:
- 1–2 **gambar referensi gaya terkunci** (crop sampul storybook sebagai anchor),
- prefix prompt tetap dari `style-guide.yaml` (painterly storybook, cerah, Nusantara, tanpa teks),
- `style_lock` (seed + hash referensi) disimpan di `story.json`.

Hasil di-cache berdasarkan `sha256(provider|model|prompt|refs|seed|size)` —
re-run tidak mengeluarkan biaya, variasi buku bisa membagi latar.

## 5. Standar konten balita (pilar #2)

Angka keras dari riset:

| Metrik | Usia 2–3 | Usia 4–5 |
|--------|----------|----------|
| Kata / halaman | 3–12 | 8–20 (maks 25) |
| Kata / buku (12 hlmn) | 120–240 | 240–420 |
| Kalimat / halaman | 1 (3–8 kata) | maks 2 (5–12 kata) |
| Balon kata / halaman | maks 2, ≤10 kata | maks 2, ≤10 kata |
| Frasa adab baru / buku | **1** | **1** |

**Beat sheet 12 halaman** (judul + 10 halaman isi full content + penutup — bukan 10 beat, cukup 4 beat besar):

| Hlm | Beat | Spec |
|-----|------|------|
| 1 | **Judul** | Judul + Qila&Ezra di adegan + tagline |
| 2 | Dalang membuka | Setup 1–2 kalimat, hook visual |
| 3 | Situasi | Ezra bertindak; balon ≤8 kata |
| 4 | Qila mengingatkan | Pengingat lembut sebelum frasa kunci |
| 5 | Qila memodelkan | **Frasa kunci** di balon |
| 6 | Ezra mencoba | Percobaan pertama; frasa diulang |
| 7 | Balasan hangat | Umi membalas salam (respons positif) |
| 8 | Gagal lucu | Wobble → coba lagi |
| 9 | Bersama | **Refrain** (kata-kata identik dgn hlm 5) |
| 10 | Transfer | Frasa sama, konteks mikro baru |
| 11 | **Box Hikmah Dalang** | Hikmah (kata anak) + doa (ID + Arab) + ajakan "Ayo bilang: ___" |
| 12 | **Penutup** | Adegan keluarga hangat, "Alhamdulillah", teaser buku berikutnya |

Pola ulang (refrain) muncul 3–4× per buku. Baca keras hlm 3–8 target **< 2 menit**.

## 6. Guardrail konten (pilar #3 — otomatis + manusia)

### Wajib akurat
- Doa/adhkar hanya dari Quran/hadis sahih; **sumber dicatat di metadata**
  (`source: "HR. Tirmidhi no. X"`), TIDAK tampil di teks anak.
- Transliterasi konsisten ("Assalamu'alaikum", tidak campur bentuk lain).
- Tidak menggambar nabi. Caregiver hangat & berbusana sopan.

### Dilarang (dicek otomatis via grep di `qa/`)
- Permalukan: "kamu anak nakal", "jahat"
- Ancaman/penakut: "azab", "neraka" dalam teks anak
- Menggurui / ceramah; menyalahkan Allah ("Allah akan marah")
- Menghina adik; klaim nasionalis di pilar 3

### Nada
Hangat, bermain, konkret (sendok, sepatu, balok). Ezra **berusaha dan membaik**
(berdaulat, bukan pasif dimarahi). Dalang = pencerita kebapakan, bukan guru.

### Checklist pre-publish (10 item — sebagian otomatis di `src/qa/`)
1. Setiap doa terverifikasi + bersumber di metadata?
2. ≤ 1 frasa baru diperkenalkan?
3. Tidak ada leksikon malu/takut di teks anak? (grep)
4. Jumlah kata/kalimat dalam band usia?
5. Ezra ditampilkan berusaha (bukan hanya gagal)?
6. Box Hikmah = hikmah + doa + ajakan orang tua?
7. Pilar + band usia ter-tag?
8. Baca keras hlm 3–8 < 2 menit?
9. Tidak ada antropomorfisasi Allah/nabi?
10. Bahasa Indonesia natural (bukan terjemahan kaku)?

## 7. Kendali biaya (pilar #4)

| Mekanisme | Detail |
|-----------|--------|
| **Cap per buku** | `config/budget.default.yaml`: `{llm: 0.05, image: 2.00, tts: 0.30, total: 2.50}`. Hard fail saat cap tercapai; state bisa di-resume. |
| **`--dry-run`** | Mencetak rencana panggilan + estimasi USD sebelum belanja. |
| **Cache hash konten** | `sha256(provider|model|prompt|refs|seed|size)` → pakai ulang aset, biaya 0 saat re-run. |
| **Library aset** | Karakter/prop dihasilkan sekali → biaya marginal 0 untuk pemeran. |
| **`cost-log.jsonl`** | Setiap panggilan API dicatat (tokens, usd) → roll-up per buku & per seri. |
| **Engine gratis dulu** | Naskah: model murah. TTS: edge-tts. Gambar: hanya bila latar belum ada di cache. |

**Target biaya per buku (12 halaman):**

| Item | Estimasi |
|------|----------|
| LLM naskah (1×) | ~$0.01–0.05 |
| Gambar latar (10–12 unik, cacheable) | ~$0.35–1.20 |
| TTS edge-tts | $0.00 |
| TTS ElevenLabs (opsional upgrade) | ~$0.05 |
| **Total** | **≈ $0.40–1.30** |

Aset karakter/prop awal (sekali bayar waktu): ~$0.50–1.00 → di-amortisasi ke semua buku.

## 8. Skema `story.json` (sumber kebenaran)

```jsonc
{
  "book_meta": {
    "slug": "adab-salam",
    "title": "Salam untuk Semua",
    "concept": "menyapa dengan salam",
    "key_phrase": "Assalamu'alaikum",
    "key_phrase_source": "HR. Bukhari no. 6217",
    "pillar": 1,
    "age_band": "2-3",
    "word_budget": 12,
    "sentence_pattern": "Saat ___, kita bilang: ___"
  },
  "style_lock": {
    "style_refs": ["<hash-sampul>"],
    "seed": 42,
    "palette": { "sky": "#E0F2FE", "sunshine": "#FEF08A", "...": "..." }
  },
  "pages": [
    {
      "page_number": 1,
      "page_type": "cover",          // cover|story|refrain|climax|closing
      "layout_type": "cover",        // template id
      "visual_scene": {
        "background_ref": "bg_rumah_pagi",     // ID dari library/cache
        "background_prompt": "…",              // hanya bila perlu generate
        "characters": [
          { "id": "qila", "pose": "wave", "x": 0.30, "y": 0.55, "scale": 1.0 }
        ],
        "props": ["frame_kayu", "cloud_megamendung"]
      },
      "dialogue": [
        { "speaker": "qila", "text": "…", "audio_text": "…" }
      ],
      "page_text": "…",
      "audio_narration": "…",
      "on_screen_text": "…",
      "dalang_note": "…",           // jadi hint performa TTS
      "repeats_of": null             // indeks halaman refrain, bila ada
    }
  ]
}
```

`page_text` = yang tampil di halaman (≤ 8–10 kata). `audio_narration` = narasi
ibu untuk TTS — mendeskripsikan gambar/suasana lebih kaya (kayak ibu membacakan
buku ke anak), **tanpa** mengulang dialog karakter. `text` = kutipan karakter di
halaman; `audio_text` = versi ucapannya (boleh beda dari teks cetak). Teks cetak
singkat; audio lebih kaya — keduanya memang tidak harus sama.

## 9. Kontrak adapter (biaya & provider bisa ditukar)

```
src/story/   generateStory(topic, opts) -> story.json      [providers.llm]
src/assets/  ensureBackground(prompt, styleLock) -> file   [providers.image]
src/audio/   synthesize(text, speaker, opts) -> mp3        [providers.tts]
src/render/  renderBook(story, assets) -> pdf + web
src/budget/  Budget.check(category, usd) / Budget.log(...)
```

Semua pemanggilan API melewati `Budget` (cap + log). `providers.yaml` memuat
endpoint/model/key-name; **kode tidak mengenal merek tertentu**.

## 10. Rencana kerja (fase)

### Fase 0 — Fondasi (sesi ini)
- [x] Riset teknologi + konten
- [x] `docs/CONCEPT.md` + `docs/PLAN.md`
- [ ] Scaffold repo (folder, config, package.json, TS, CLI)
- [ ] Install software: Playwright, pdf-lib, edge-tts, font Fredoka/Nunito
- [ ] `topics/catalog.yaml` (24 topik dari riset)
- [ ] Library aset awal: pose Qila & Ezra + ornamen (frame, mega mendung, balon)

### Fase 1 — Buku pertama `adab-salam` (sesi ini)
- [ ] `story.json` (12 halaman, beat sheet §5)
- [ ] Latar adegan via image API (style lock dari sampul)
- [ ] Audio narasi per halaman (TTS MiMo/edge-tts)
- [ ] Render: `book.pdf` + `web/` reader
- [ ] QA checklist otomatis + review

### Fase 2 — Pipeline yang bisa diulang (sesi lanjutan)
- [ ] CLI end-to-end: `bun run book:new adab-bismillah` → buku jadi
- [ ] `--dry-run` + budget enforcement
- [ ] Cache hash & cost-log roll-up
- [ ] QA otomatis penuh (guardrail §6)

### Fase 3 — Skala seri
- [ ] Batch produksi dari katalog (urutan prioritas pilar 1)
- [ ] Review loop: draft → tampilan web → koreksi → final
- [ ] Variasi busana Nusantara (untuk seri video Rempah menyusul)

### Fase 4 — Integrasi RumaQ (di luar repo ini)
- [ ] Plugin "buku cerita" di RumaQ (manifest, ports, household enablement)
- [ ] Menyajikan buku yang sudah diproduksi ke household

## 11. Buku pertama: `adab-salam`

| Field | Nilai |
|-------|-------|
| Slug | `adab-salam` |
| Judul | **Salam untuk Semua** |
| Konsep | Menyapa dengan salam |
| Frasa kunci | "Assalamu'alaikum" |
| Pilar | 1 — Rumah & Keluarga |
| Usia | 2–3 |
| Hook | Ezra lupa salam saat Umi pulang; Qila ingatkan dengan senyum. |

Kenapa ini duluan: paling universal, frasa paling mudah diucap balita, cocok jadi
buku emas referensi sekaligus bukti pipeline.

## 12. Pertanyaan terbuka untuk Mas-sama

1. **Ukuran cetak** — persegi 1:1 (papan buku balita) atau landscape 16:9 spread?
   Default: **portrait 3:4** (150×200 mm, ala contoh halaman storybook).
2. **Hak cipta & kredit** — "Karya Dalang: Mas-sama & Keluarga" tetap dicetak di
   setiap buku?
3. **Nama karakter** — Qila & Ezra memakai nama asli anak? Atau nama samaran?
   (Implikasi privasi jika buku dibagikan publik.)
