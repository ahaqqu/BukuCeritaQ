// Template HTML halaman buku v2 — layout ala research/contoh-bab1.png.
// Portrait 3:4, full-bleed scene painterly + overlay: bingkai ukir, pita BAB,
// kotak narasi perkamen, balon kata, kotak "Pesan Ki Dalang".
import { pathToFileURL } from 'node:url'
import type { Page, StoryBook } from '../types.ts'

/** URL file:// valid lintas OS (path Windows punya backslash & drive letter). */
function fu(p: string): string {
  return pathToFileURL(p).href
}

export interface AssetPaths {
  background: string // scene painterly per halaman (png/jpg)
  characters: Record<string, string> // dipertahankan untuk kompatibilitas schema
  fonts: { display: string; body: string }
  frame?: string // overlay bingkai kayu ukir (png transparan)
  ribbon?: string // overlay pita batik (png transparan)
}

export const PAGE_W = 1240
export const PAGE_H = 1653

const SERIES_BAR = 'PETUALANGAN ADAB QILA & EZRA'

/** CSS untuk satu halaman (dipakai ulang oleh web reader). */
export function pageCSS(book: StoryBook, assets: AssetPaths): string {
  const p = book.style_lock.palette
  return `
@font-face {
  font-family: 'Display';
  src: url('${fu(assets.fonts.display)}') format('truetype');
  font-weight: 400;
}
@font-face {
  font-family: 'Body';
  src: url('${fu(assets.fonts.body)}') format('truetype');
  font-weight: 400 800;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
.page {
  position: relative;
  width: ${PAGE_W}px;
  height: ${PAGE_H}px;
  overflow: hidden;
  background: ${p.cream ?? '#FFF8E7'};
  font-family: 'Body', 'Nunito', sans-serif;
  color: ${p.slate ?? '#1E293B'};
}
.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}
.scene-veil {
  position: absolute;
  inset: 0;
  z-index: 2;
  background:
    radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 55%, rgba(43,27,18,0.10) 100%);
  pointer-events: none;
}
.frame {
  position: absolute;
  top: -5%;
  left: -5%;
  width: 110%;
  height: 110%;
  object-fit: fill;
  z-index: 40;
  pointer-events: none;
}
.chrome {
  position: absolute;
  inset: 0;
  z-index: 10;
}
.series-bar {
  position: absolute;
  top: 34px;
  left: 130px;
  right: 130px;
  height: 66px;
  border-radius: 14px;
  background: linear-gradient(180deg, #4A2C15 0%, #6B4226 55%, #4A2C15 100%);
  border: 3px solid ${p.gold ?? '#D4A017'};
  box-shadow: 0 6px 14px rgba(43,27,18,0.35), inset 0 2px 0 rgba(255,248,231,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Display', sans-serif;
  font-size: 30px;
  letter-spacing: 2.5px;
  color: #FFF3D6;
  text-shadow: 0 2px 0 rgba(43,27,18,0.85);
}
.bab-label {
  position: absolute;
  top: 118px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: 'Display', sans-serif;
  font-size: 46px;
  color: ${p.orange ?? '#F97316'};
  text-shadow:
    -3px -3px 0 #FFF8E7, 3px -3px 0 #FFF8E7, -3px 3px 0 #FFF8E7, 3px 3px 0 #FFF8E7,
    0 5px 0 ${p.gold ?? '#D4A017'};
}
.ribbon-wrap {
  position: absolute;
  top: 176px;
  left: 60px;
  right: 60px;
  height: 170px;
}
.ribbon-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.ribbon-title {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 70px;
  font-family: 'Display', sans-serif;
  font-size: 62px;
  line-height: 1.06;
  color: #FFF3D6;
  text-shadow:
    -3px -3px 0 #4A2C15, 3px -3px 0 #4A2C15, -3px 3px 0 #4A2C15, 3px 3px 0 #4A2C15,
    0 5px 0 rgba(43,27,18,0.8);
}
.narration {
  position: absolute;
  left: 150px;
  right: 150px;
  top: 220px;
  background: ${p.parchment ?? '#F5E6C8'};
  border: 5px solid #8B5A2B;
  border-radius: 22px;
  padding: 30px 38px;
  font-family: 'Body', sans-serif;
  font-weight: 700;
  font-size: 33px;
  line-height: 1.5;
  text-align: center;
  color: #2B1B12;
  box-shadow: 0 10px 22px rgba(43,27,18,0.28), inset 0 2px 0 rgba(255,255,255,0.45);
  z-index: 12;
}
.pesan-tab {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 470px;
  display: flex;
  justify-content: center;
  z-index: 15;
}
.pesan-tab span {
  background: linear-gradient(180deg, #B8860B 0%, ${p.gold ?? '#D4A017'} 55%, #A67708 100%);
  border: 3px solid #6B4226;
  border-radius: 14px 14px 0 0;
  padding: 12px 42px;
  font-family: 'Display', sans-serif;
  font-size: 32px;
  color: #FFF8E7;
  text-shadow: 0 2px 0 rgba(43,27,18,0.75);
  box-shadow: 0 -4px 12px rgba(43,27,18,0.25);
}
.pesan-box {
  position: absolute;
  left: 130px;
  right: 130px;
  bottom: 150px;
  background: ${p.parchment ?? '#F5E6C8'};
  border: 5px solid #8B5A2B;
  border-radius: 22px;
  padding: 30px 36px;
  font-family: 'Body', sans-serif;
  font-weight: 700;
  font-size: 30px;
  line-height: 1.5;
  text-align: center;
  color: #2B1B12;
  box-shadow: 0 12px 26px rgba(43,27,18,0.3), inset 0 2px 0 rgba(255,255,255,0.45);
  z-index: 15;
}
.pesan-box b {
  font-family: 'Display', sans-serif;
  font-weight: 400;
  font-size: 31px;
  color: #8B4513;
}
.on-screen {
  position: absolute;
  left: 140px;
  right: 140px;
  bottom: 190px;
  text-align: center;
  font-family: 'Display', sans-serif;
  font-size: 56px;
  line-height: 1.14;
  color: #FFF3D6;
  text-shadow:
    -3px -3px 0 #4A2C15, 3px -3px 0 #4A2C15, -3px 3px 0 #4A2C15, 3px 3px 0 #4A2C15,
    0 6px 0 rgba(43,27,18,0.75);
  z-index: 14;
}
.credit {
  position: absolute;
  bottom: 92px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: 'Body', sans-serif;
  font-weight: 700;
  font-size: 24px;
  color: #FFF3D6;
  text-shadow: 0 2px 0 rgba(43,27,18,0.8);
  z-index: 14;
}
`
}

/** HTML lengkap satu halaman. */
export function renderPageHTML(book: StoryBook, page: Page, assets: AssetPaths): string {
  const p = book.style_lock.palette
  const isCover = page.page_type === 'cover'
  const isHikmah = page.layout_type === 'hikmah'
  const isClosing = page.page_type === 'closing'

  // Narasi: gabungkan narration_text dari dialog (teks untuk pembaca).
  const narrationText = page.dialogue
    .map((d) => d.narration_text || d.text)
    .filter(Boolean)
    .join(' ')
    .trim()

  const seriesBar = `<div class="series-bar">${escapeHtml(SERIES_BAR)}</div>`

  const titleBlock = isCover
    ? `<div class="bab-label">BAB 1</div>
       <div class="ribbon-wrap">
         ${assets.ribbon ? `<img class="ribbon-img" src="${fu(assets.ribbon)}" alt="">` : ''}
         <div class="ribbon-title">${escapeHtml(book.book_meta.title)}</div>
       </div>`
    : ''

  const narrationBox = narrationText && !isCover
    ? `<div class="narration">${escapeHtml(narrationText)}</div>`
    : narrationText && isCover
      ? `<div class="narration">${escapeHtml(narrationText)}</div>`
      : ''

  // Kotak "Pesan Ki Dalang" hanya untuk halaman hikmah/penutup (teks untuk pembaca).
  const pesanBox = isHikmah
    ? `<div class="pesan-tab"><span>Pesan Ki Dalang</span></div>
       <div class="pesan-box"><b>PESAN ADAB:</b> ${escapeHtml(page.dalang_note ?? '')}</div>`
    : isClosing
      ? `<div class="pesan-tab"><span>Pesan Ki Dalang</span></div>
         <div class="pesan-box"><b>PESAN ADAB:</b> ${escapeHtml(page.dalang_note ?? '')}</div>`
      : ''

  const onScreen = page.on_screen_text && !isCover && !isClosing
    ? `<div class="on-screen">${escapeHtml(page.on_screen_text)}</div>`
    : ''

  const closingText = isClosing && page.on_screen_text
    ? `<div class="on-screen">${escapeHtml(page.on_screen_text)}</div>`
    : ''

  const credit = isCover || isClosing
    ? `<div class="credit">${escapeHtml(book.book_meta.credit ?? 'Karya Dalang: Mas-sama & Keluarga')}</div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${pageCSS(book, assets)}</style>
</head>
<body>
<div class="page" id="page-${page.page_number}">
  <img class="scene" src="${fu(assets.background)}" alt="">
  <div class="scene-veil"></div>
  <div class="chrome">
    ${seriesBar}
    ${titleBlock}
    ${narrationBox}
    ${onScreen}
    ${pesanBox}
    ${closingText}
    ${credit}
  </div>
  ${assets.frame ? `<img class="frame" src="${fu(assets.frame)}" alt="">` : ''}
</div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
