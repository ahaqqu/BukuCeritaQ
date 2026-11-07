#!/usr/bin/env python3
"""Generate per-page multi-voice narration audio for a book (edge-tts, Indonesian).

Usage:
  python scripts/tts-book.py <book-slug> [--overwrite]

Per page it builds a spoken sequence:
  - narration / story text  -> "ibu"   (warm mother narrator voice)
  - dialogue by Qila        -> "qila"  (bright girl voice)
  - dialogue by Ezra        -> "ezra"  (young boy voice)
  - hikmah / closing notes  -> "ibu"

Segments are synthesized separately then concatenated (ID3-stripped MP3
frames) into books/<slug>/audio/page-NN.mp3 and web/audio/page-NN.mp3.
"""
from __future__ import annotations

import asyncio
import json
import shutil
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent

# Hanya ada 2 voice Indonesia di edge-tts (GadisNeural, ArdiNeural);
# perbedaan karakter dibangun lewat pitch & rate.
VOICES = {
    "ibu": {"voice": "id-ID-GadisNeural", "rate": "-8%", "pitch": "-4Hz"},
    "qila": {"voice": "id-ID-GadisNeural", "rate": "+2%", "pitch": "+6Hz"},
    "ezra": {"voice": "id-ID-ArdiNeural", "rate": "+8%", "pitch": "+14Hz"},
    "dalang": {"voice": "id-ID-GadisNeural", "rate": "-8%", "pitch": "-4Hz"},
    "narrator": {"voice": "id-ID-GadisNeural", "rate": "-8%", "pitch": "-4Hz"},
}


def segments_for_page(page: dict) -> list[tuple[str, str]]:
    """Return [(voice_key, text), ...] in reading order for one page."""
    segs: list[tuple[str, str]] = []
    for d in page.get("dialogue", []):
        speaker = d.get("speaker", "dalang")
        text = (d.get("text") or "").strip()
        narr = (d.get("narration_text") or "").strip()
        if speaker in ("qila", "ezra"):
            # narator bercerita dulu, lalu karakter mengucapkan quote-nya
            if narr and narr != text:
                segs.append(("ibu", narr))
            if text:
                segs.append((speaker, text))
        else:
            segs.append(("ibu", narr or text))
    if not segs:
        # sampul / penutup / hikmah tanpa dialog
        if page.get("layout_type") == "hikmah":
            t = (page.get("dalang_note") or "").strip()
        else:
            t = (page.get("on_screen_text") or "").strip()
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


async def synth(text: str, cfg: dict, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(
        text, cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"]
    )
    await communicate.save(str(out))


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
    audio_dir = book_dir / "audio"
    web_audio_dir = book_dir / "web" / "audio"
    tmp_dir = book_dir / "audio" / "_segments"
    audio_dir.mkdir(parents=True, exist_ok=True)
    web_audio_dir.mkdir(parents=True, exist_ok=True)

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
            cfg = VOICES.get(vkey, VOICES["ibu"])
            seg_file = tmp_dir / f"page-{n:02d}-{i:02d}-{vkey}.mp3"
            print(f"page {n:02d} seg {i} [{vkey} -> {cfg['voice']}]: {text[:52]}...")
            await synth(text, cfg, seg_file)
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

    print("TTS multi-voice selesai:", audio_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
