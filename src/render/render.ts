// Render buku: HTML halaman → PNG (web) + PDF (cetak) + paket web reader.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import type { StoryBook } from '../types.ts'
import { renderPageHTML, type AssetPaths } from './template.ts'

export interface RenderResult {
  pagesDir: string
  pdfPath: string
  webDir: string
}

export async function renderBook(
  book: StoryBook,
  assets: AssetPaths,
  bookDir: string,
): Promise<RenderResult> {
  const pagesDir = join(bookDir, 'pages')
  const webDir = join(bookDir, 'web')
  mkdirSync(pagesDir, { recursive: true })
  mkdirSync(join(webDir, 'pages'), { recursive: true })
  mkdirSync(join(webDir, 'audio'), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1181, height: 1181 },
    deviceScaleFactor: 1.5,
  })
  const page = await context.newPage()

  const pageImages: string[] = []
  for (const p of book.pages) {
    const html = renderPageHTML(book, p, assets)
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.waitForTimeout(150)
    const file = join(pagesDir, `page-${String(p.page_number).padStart(2, '0')}.png`)
    await page.screenshot({ path: file, type: 'png' })
    // salin ke paket web
    const webFile = join(webDir, 'pages', basename(file))
    copyFileSync(file, webFile)
    pageImages.push(file)
    console.log(`rendered page ${p.page_number} → ${basename(file)}`)
  }

  // PDF cetak (satu halaman per sheet A4 persegi / custom)
  const pdf = await PDFDocument.create()
  for (const imgPath of pageImages) {
    const bytes = readFileSync(imgPath)
    const img = await pdf.embedPng(bytes)
    const pagePdf = pdf.addPage([1181, 1181])
    pagePdf.drawImage(img, { x: 0, y: 0, width: 1181, height: 1181 })
  }
  const pdfPath = join(bookDir, 'book.pdf')
  writeFileSync(pdfPath, await pdf.save())
  console.log(`PDF → ${pdfPath}`)

  // paket web reader
  writeFileSync(join(webDir, 'book.json'), JSON.stringify(book, null, 2))
  writeFileSync(join(webDir, 'index.html'), readerHTML(book))
  console.log(`web → ${join(webDir, 'index.html')}`)

  await browser.close()
  return { pagesDir, pdfPath, webDir }
}

function readerHTML(book: StoryBook): string {
  const titles = JSON.stringify(book.pages.map((p) => p.on_screen_text ?? book.book_meta.title))
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${escapeHtml(book.book_meta.title)} — Petualangan Adab Qila & Ezra</title>
<style>
  :root { --slate:#1E293B; --orange:#F97316; --cream:#FFF8E7; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body { height:100%; background:var(--slate); overflow:hidden; font-family:'Nunito','Poppins',sans-serif; }
  #stage { position:relative; width:100vw; height:100dvh; display:flex; align-items:center; justify-content:center; }
  #pageImg { max-width:100vw; max-height:100dvh; width:auto; height:auto; display:block; border-radius:8px; box-shadow:0 12px 40px rgba(0,0,0,.45); }
  .tap { position:absolute; top:0; bottom:0; width:34%; z-index:5; }
  #tapPrev { left:0; }
  #tapNext { right:0; }
  #tapMid { left:34%; width:32%; }
  #hud {
    position:absolute; left:0; right:0; bottom:0; padding:14px 18px 22px;
    display:flex; align-items:center; gap:12px;
    background:linear-gradient(transparent, rgba(15,23,42,.82)); color:#fff;
  }
  #hud .title { flex:1; font-size:15px; opacity:.95; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #hud button {
    min-width:64px; min-height:64px; border:0; border-radius:18px;
    background:var(--orange); color:#fff; font-size:22px; font-weight:800;
    box-shadow:0 6px 0 rgba(194,65,12,.55);
  }
  #hud button:active { transform:translateY(3px); box-shadow:0 3px 0 rgba(194,65,12,.55); }
  #progress { position:absolute; top:0; left:0; height:5px; background:var(--orange); width:0%; transition:width .25s; z-index:10; }
  #hint {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    background:rgba(15,23,42,.72); color:#fff; font-size:22px; font-weight:800;
    text-align:center; padding:24px; z-index:20;
  }
</style>
</head>
<body>
<div id="progress"></div>
<div id="stage">
  <img id="pageImg" src="pages/page-01.png" alt="halaman">
  <div class="tap" id="tapPrev"></div>
  <div class="tap" id="tapMid"></div>
  <div class="tap" id="tapNext"></div>
  <div id="hud">
    <button id="btnPrev" aria-label="sebelumnya">‹</button>
    <div class="title" id="title"></div>
    <button id="btnPlay" aria-label="putar narasi">▶</button>
    <button id="btnNext" aria-label="berikutnya">›</button>
  </div>
  <div id="hint">Ketuk untuk mulai membaca<br><small style="opacity:.8;font-weight:600">Qila & Ezra menantimu!</small></div>
</div>
<audio id="audio"></audio>
<script>
const total = ${book.pages.length};
const titles = ${titles};
let idx = 0, started = false;
const img = document.getElementById('pageImg');
const title = document.getElementById('title');
const progress = document.getElementById('progress');
const audio = document.getElementById('audio');
const hint = document.getElementById('hint');

function pageFile(n) { return 'pages/page-' + String(n).padStart(2,'0') + '.png'; }
function audioFile(n) { return 'audio/page-' + String(n).padStart(2,'0') + '.mp3'; }

function show(n) {
  idx = Math.max(0, Math.min(total - 1, n));
  img.src = pageFile(idx + 1);
  title.textContent = (idx + 1) + '/' + total + ' · ' + (titles[idx] || '');
  progress.style.width = ((idx + 1) / total * 100) + '%';
  playAudio();
}

function playAudio() {
  const src = audioFile(idx + 1);
  audio.src = src;
  audio.play().catch(() => {/* autoplay diblokir sampai gestur pengguna */});
}

function start() {
  if (started) return;
  started = true;
  hint.style.display = 'none';
  show(0);
}

hint.addEventListener('click', start);
document.getElementById('tapNext').addEventListener('click', () => { start(); show(idx + 1); });
document.getElementById('tapPrev').addEventListener('click', () => { start(); show(idx - 1); });
document.getElementById('btnNext').addEventListener('click', (e) => { e.stopPropagation(); show(idx + 1); });
document.getElementById('btnPrev').addEventListener('click', (e) => { e.stopPropagation(); show(idx - 1); });
document.getElementById('btnPlay').addEventListener('click', (e) => {
  e.stopPropagation();
  if (audio.paused) audio.play(); else audio.pause();
});
// swipe
let x0 = null;
document.getElementById('stage').addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, {passive:true});
document.getElementById('stage').addEventListener('touchend', (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 45) { start(); show(idx + (dx < 0 ? 1 : -1)); }
  x0 = null;
}, {passive:true});
audio.addEventListener('ended', () => { /* diam di halaman yang sama */ });
</script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
