# TTS — Suara Narasi Buku

Dua engine didukung `scripts/tts-book.py`:

| Engine | Biaya | Kualitas | Kapan pakai |
|--------|-------|----------|-------------|
| `edge-tts` | Gratis | Cukup (2 voice Indonesia saja) | Default, draft, revisi |
| `elevenlabs` | Starter $5/bln (30k credits ≈ 30 menit) | Sangat bagus, multibahasa | Final / bila perlu suara khas per karakter |

Fallback otomatis: bila engine `elevenlabs` gagal (key belum ada, kuota habis,
jaringan), skrip otomatis jatuh ke `edge-tts` — audio tetap terbit.

## Struktur naskah audio (terpisah dari teks cetak)

Di `books/<slug>/story.json` tiap halaman:

- `page_text` — teks **cetak** di halaman (singkat, untuk pembaca anak).
- `audio_narration` — narasi **ibu** untuk audio: mendeskripsikan gambar &
  suasana, **tanpa** mengulang apa yang akan dikatakan Qila/Ezra.
- `dialogue[].text` — kutipan karakter (teks cetak).
- `dialogue[].audio_text` — versi **ucapan** (opsional; boleh beda dari teks
  cetak — lebih hidup, tambahan kata kecil, dsb.).

Contoh halaman 3:

```
page_text:        "Ezra berlari riang menyambut Umi."
audio_narration:  "Ezra berlari riang melihat Umi yang pulang di depan pagar.
                   Wah, kecil-kecil cepat sekali larinya!"
dialogue:         ezra "Umi pulang!"   → suara Ezra
```

Ibu **tidak** mengucapkan "Umi pulang!" — itu dialog Ezra.

## Suara

Mapping per karakter ada di `config/voices.json` (`ibu`, `qila`, `ezra`, `umi`).
Tiap suara punya:

- `engine` — `"edge-tts"` atau `"elevenlabs"`
- `voice_id` — ID suara ElevenLabs (kosongkan bila pakai edge-tts)
- `stability`, `similarity_boost`, `style`, `use_speaker_boost` — setelan ElevenLabs
- `voice`, `rate`, `pitch` — setelan edge-tts

## Cara pindah ke ElevenLabs

1. **Daftar** di <https://elevenlabs.io> → paket **Starter** ($5/bln) cukup untuk
   ±1 buku penuh per bulan; paket free (10k credits ≈ 10 menit) bisa untuk coba-coba.

2. **Buat API key** — menu *Profile → API Keys → Create API Key*.
   Simpan; jangan commit ke repo.

3. **Set env var** (PowerShell, sesi sekarang):
   ```powershell
   $env:ELEVENLABS_API_KEY = "sk_..."
   ```
   Agar permanen: `setx ELEVENLABS_API_KEY "sk_..."` lalu buka terminal baru.

4. **Pilih suara** di *Voice Library* ElevenLabs (atau *Voices → Add Voice*):
   - **ibu** (narator) — suara perempuan dewasa hangat, mis. "Rachel", "Matilda"
   - **qila** — suara anak perempuan ceria, mis. "Lily", "Alice"
   - **ezra** — suara anak laki polos, mis. "Josh", "Fin"
   - **umi** — suara perempuan dewasa (bisa clone suara istri via *Voice Clone*)
   Klik suara → *Add to VoiceLab* → salin **Voice ID** (format `XxYyZz...`).

5. **Isi `config/voices.json`** — untuk tiap suara:
   ```json
   "ibu": {
     "engine": "elevenlabs",
     "voice_id": "PASTE_VOICE_ID_DI_SINI",
     "stability": 0.55,
     "similarity_boost": 0.8
   }
   ```
   (field `voice`/`rate`/`pitch` edge-tts dibiarkan saja — dipakai saat fallback)

6. **Regen audio:**
   ```powershell
   & $env:MIMO_PYTHON scripts\tts-book.py adab-salam --overwrite
   ```
   Cek log: baris `TTS multi-voice selesai (elevenlabs)` = sukses penuh;
   ada `(edge-tts)` = sebagian fallback (lihat pesan `! ElevenLabs gagal`).

## Biaya kasar

| Aset | Perkiraan |
|------|-----------|
| 12 halaman × ±30 detik | ±6 menit audio |
| ElevenLabs | ±6.000 credits ≈ $1 dari kuota Starter |
| edge-tts | $0 |

## Catatan

- Model `eleven_multilingual_v2` mendukung Bahasa Indonesia dengan baik.
- `voice_settings` default: stability 0.5, similarity_boost 0.75, style 0.15.
  Naikkan `stability` bila suara terlalu bervariasi; turunkan bila terlalu datar.
- Untuk suara karakter yang konsisten antar buku, **clone** suara sekali
  (Voice Clone ElevenLabs) lalu pakai `voice_id` yang sama di semua buku.
