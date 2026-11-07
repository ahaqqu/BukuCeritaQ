#!/usr/bin/env python3
"""Generate per-page multi-voice narration audio for a book.

Usage:
  python scripts/tts-book.py <book-slug> [--overwrite]

Naskah audio (cerita lisan) TERPISAH dari teks cetak halaman:
  - audio_narration  -> "ibu"   narator ibu: mendeskripsikan gambar/suasana,
                        TANPA mengulang apa yang akan dikatakan Qila/Ezra.
  - dialogue[].text  -> suara karakter (qila/ezra/umi), versi ucapan boleh
                        beda dari teks cetak lewat audio_text.
  - page_text        -> teks cetak di halaman (tidak dibacakan apa adanya).

Engine per suara (config/voices.json):
  - "elevenlabs" -> ElevenLabs TTS (butuh env ELEVENLABS_API_KEY + voice_id)
  - "edge-tts"   -> Microsoft Edge TTS gratis (fallback otomatis)

Segments disintesis lalu digabung (frame MP3 tanpa ID3) menjadi
books/<slug>/audio/page-NN.mp3 dan web/audio/page-NN.mp3.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent

# Fallback bila config/voices.json tidak ada / tidak lengkap.
# Hanya ada 2 voice Indonesia di edge-tts (GadisNeural, ArdiNeural);
# perbedaan karakter dibangun lewat pitch & rate.
DEFAULT_VOICES = {
    "ibu": {"engine": "edge-tts", "voice": "id-ID-GadisNeural", "rate": "-8%", "pitch": "-4Hz"},
    "qila": {"engine": "edge-tts", "voice": "id-ID-GadisNeural", "rate": "+2%", "pitch": "+6Hz"},
    "ezra": {"engine": "edge-tts", "voice": "id-ID-ArdiNeural", "rate": "+8%", "pitch": "+14Hz"},
    "umi": {"engine": "edge-tts", "voice": "id-ID-GadisNeural", "rate": "-4%", "pitch": "-2Hz"},
    "dalang": {"engine": "edge-tts", "voice": "id-ID-GadisNeural", "rate": "-8%", "pitch": "-4Hz"},
    "narrator": {"engine": "edge-tts", "voice": "id-ID-GadisNeural", "rate": "-8%", "pitch": "-4Hz"},
}

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
ELEVENLABS_MODEL = "eleven_multilingual_v2"


def load_voices() -> dict:
    cfg_path = ROOT / "config" / "voices.json"
    if not cfg_path.exists():
        return DEFAULT_VOICES
    try:
        raw = json.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"voices.json tidak terbaca ({e}) — pakai default edge-tts")
        return DEFAULT_VOICES
    voices = {}
    for key, val in raw.items():
        if not isinstance(val, dict):
            continue
        merged = dict(DEFAULT_VOICES.get(key, DEFAULT_VOICES["ibu"]))
        merged.update(val)
        voices[key] = merged
    for key, val in DEFAULT_VOICES.items():
        voices.setdefault(key, val)
    return voices


def segments_for_page(page: dict) -> list[tuple[str, str]]:
    """Return [(voice_key, text), ...] in reading order for one page.

    Urutan: narasi ibu (suasana/gambar) dulu, baru dialog karakter.
    Narasi ibu tidak boleh mengulang kutipan dialog karakter.
    """
    segs: list[tuple[str, str]] = []

    narr = (page.get("audio_narration") or "").strip()
    if narr:
        segs.append(("ibu", narr))

    for d in page.get("dialogue", []):
        speaker = d.get("speaker", "dalang")
        # versi ucapan boleh beda dari teks cetak
        text = (d.get("audio_text") or d.get("text") or "").strip()
        if text:
            segs.append((speaker, text))

    if not segs:
        # sampul/penutup tanpa narasi eksplisit
        t = (page.get("dalang_note") or page.get("on_screen_text") or "").strip()
        if t:
            segs.append(("ibu", t))
    return segs


def strip_id3(data: bytes) -> bytes:
    """Buang header ID3v2/v1 supaya frame MP3 aman digabung berurutan."""
    if data[:3] == b"ID3" and len(data) > 10:
        size = ((data[6] & 0x7F) << 21) | ((data[7] & 0x7F) << 14) | ((data[8] & 0x7F) << 7) | (data[9] & 0x7F)
        data = data[10 + size:]
    if len(data) > 128 and data[-128:-125] == b"TAG":
        data = data[:-128]
    return data


def synth_elevenlabs(text: str, cfg: dict, out: Path) -> None:
    """Sintesis via ElevenLabs TTS API -> MP3."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    voice_id = (cfg.get("voice_id") or "").strip()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY belum di-set")
    if not voice_id:
        raise RuntimeError(f"voice_id ElevenLabs kosong untuk suara ini")

    body = json.dumps({
        "text": text,
        "model_id": cfg.get("model_id") or ELEVENLABS_MODEL,
        "voice_settings": {
            "stability": float(cfg.get("stability", 0.5)),
            "similarity_boost": float(cfg.get("similarity_boost", 0.75)),
            "style": float(cfg.get("style", 0.15)),
            "use_speaker_boost": bool(cfg.get("use_speaker_boost", True)),
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        ELEVENLABS_TTS_URL.format(voice_id=voice_id),
        data=body,
        method="POST",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if not data:
        raise RuntimeError("ElevenLabs mengembalikan audio kosong")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)


async def synth_edge(text: str, cfg: dict, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(
        text, cfg.get("voice", "id-ID-GadisNeural"),
        rate=cfg.get("rate", "+0%"), pitch=cfg.get("pitch", "+0Hz"),
    )
    await communicate.save(str(out))


async def synth(text: str, cfg: dict, out: Path) -> str:
    """Sintesis satu segmen. Return engine yang dipakai."""
    engine = (cfg.get("engine") or "edge-tts").lower()
    if engine == "elevenlabs":
        try:
            synth_elevenlabs(text, cfg, out)
            return "elevenlabs"
        except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError, OSError) as e:
            print(f"  ! ElevenLabs gagal ({e}) — fallback edge-tts")
    await synth_edge(text, cfg, out)
    return "edge-tts"


async def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    slug = sys.argv[1]
    overwrite = "--overwrite" in sys.argv[2:]

    book_dir = ROOT / "books" / slug
    story_path = book_dir / "story.json"
    if not story_path.exists():
        print(f"story.json tidak ditemukan: {story_path}")
        return 1

    story = json.loads(story_path.read_text(encoding="utf-8"))
    voices = load_voices()
    audio_dir = book_dir / "audio"
    web_audio_dir = book_dir / "web" / "audio"
    tmp_dir = book_dir / "audio" / "_segments"
    audio_dir.mkdir(parents=True, exist_ok=True)
    web_audio_dir.mkdir(parents=True, exist_ok=True)

    engines_used: set[str] = set()

    for page in story["pages"]:
        n = page["page_number"]
        out = audio_dir / f"page-{n:02d}.mp3"
        web_out = web_audio_dir / f"page-{n:02d}.mp3"
        if out.exists() and not overwrite:
            print(f"skip page {n} (sudah ada)")
            continue

        segs = segments_for_page(page)
        if not segs:
            print(f"skip page {n} (tidak ada teks)")
            continue

        blobs: list[bytes] = []
        for i, (vkey, text) in enumerate(segs):
            cfg = voices.get(vkey, voices["ibu"])
            seg_file = tmp_dir / f"page-{n:02d}-{i:02d}-{vkey}.mp3"
            print(f"page {n:02d} seg {i} [{vkey}]: {text[:52]}...")
            engine = await synth(text, cfg, seg_file)
            engines_used.add(engine)
            blobs.append(strip_id3(seg_file.read_bytes()))

        out.write_bytes(b"".join(blobs))
        shutil.copyfile(out, web_out)
        for b in tmp_dir.glob(f"page-{n:02d}-*.mp3"):
            b.unlink()

    if tmp_dir.exists():
        try:
            tmp_dir.rmdir()
        except OSError:
            pass

    print(f"TTS multi-voice selesai ({', '.join(sorted(engines_used))}):", audio_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
