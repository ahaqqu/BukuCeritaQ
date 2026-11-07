// CLI BukuCeritaQ — satu entrypoint untuk semua tahap pipeline.
// Pemakaian: bun run src/cli.ts <command> [slug]
// Command: qa | render | build | new
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { storyBookSchema } from './story/schema.ts'
import { runQA, formatIssues } from './qa/checklist.ts'
import { renderBook } from './render/render.ts'
import type { AssetPaths } from './render/template.ts'
import { Budget, loadCaps, budgetPathFor } from './budget/budget.ts'
import type { StoryBook } from './types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOOKS = join(ROOT, 'books')

function bookDir(slug: string): string {
  return join(BOOKS, slug)
}

function loadStory(slug: string): StoryBook {
  const p = join(bookDir(slug), 'story.json')
  if (!existsSync(p)) throw new Error(`story.json tidak ditemukan: ${p}`)
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  return storyBookSchema.parse(raw) as StoryBook
}

/** Kumpulkan path aset yang dibutuhkan render dari folder assets/. */
function collectAssets(slug: string): AssetPaths {
  const fontsDir = join(ROOT, 'assets', 'fonts')
  const chars: Record<string, string> = {}

  const posesDir = (id: string) => join(ROOT, 'assets', 'characters', id)
  for (const id of ['qila', 'ezra'] as const) {
    const dir = posesDir(id)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!/\.(png|webp)$/i.test(f)) continue
      const pose = f.replace(/\.(png|webp)$/i, '')
      chars[`${id}:${pose}`] = join(dir, f)
    }
  }

  // background: cari di assets/backgrounds lalu books/<slug>/backgrounds
  const bgCandidates = [
    join(bookDir(slug), 'backgrounds'),
    join(ROOT, 'assets', 'backgrounds'),
  ]
  const bgMap = new Map<string, string>()
  for (const dir of bgCandidates) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!/\.(png|jpg|jpeg|webp)$/i.test(f)) continue
      const key = f.replace(/\.(png|jpg|jpeg|webp)$/i, '')
      if (!bgMap.has(key)) bgMap.set(key, join(dir, f))
    }
  }

  const overlaysDir = join(ROOT, 'assets', 'overlays')
  const frame = join(overlaysDir, 'frame-kayu.png')
  const ribbon = join(overlaysDir, 'ribbon-batik.png')

  return {
    background: '', // diisi per halaman saat render (scene painterly)
    characters: chars,
    fonts: {
      display: join(fontsDir, 'FredokaOne-Regular.ttf'),
      body: join(fontsDir, 'Nunito-Variable.ttf'),
    },
    frame: existsSync(frame) ? frame : undefined,
    ribbon: existsSync(ribbon) ? ribbon : undefined,
    _bgMap: bgMap,
    _defaultBg: bgMap.get('default') ?? [...bgMap.values()][0] ?? '',
  } as AssetPaths & { _bgMap: Map<string, string>; _defaultBg: string }
}

function backgroundFor(assets: AssetPaths, ref: string): string {
  const map = (assets as unknown as { _bgMap: Map<string, string> })._bgMap
  const fallback = (assets as unknown as { _defaultBg: string })._defaultBg
  return map.get(ref) ?? fallback ?? ''
}

async function cmdRender(slug: string): Promise<void> {
  const story = loadStory(slug)
  const assets = collectAssets(slug)
  // isi background per halaman
  for (const p of story.pages) {
    const bg = backgroundFor(assets, p.visual_scene.background_ref)
    if (!bg) throw new Error(`Background tidak ditemukan: ${p.visual_scene.background_ref}`)
  }
  // render pakai background default dulu (template menerima satu bg; per-halaman
  // di-hardcode lewat patch sederhana di bawah)
  const patchedAssets = { ...assets, background: backgroundFor(assets, story.pages[0]!.visual_scene.background_ref) }
  // Untuk multi-bg, tulis HTML per halaman dengan bg masing-masing:
  await renderBookWithPerPageBg(story, assets, bookDir(slug))
  console.log('Render selesai:', slug)
}

async function renderBookWithPerPageBg(
  story: StoryBook,
  assets: AssetPaths,
  dir: string,
): Promise<void> {
  // bungkus renderBook dengan inject background per halaman
  const bgMap = (assets as unknown as { _bgMap: Map<string, string> })._bgMap
  const fallback = (assets as unknown as { _defaultBg: string })._defaultBg
  // patch: set .background sebelum tiap halaman di-render — dilakukan di renderBook
  // dengan menambah parameter resolver. Untuk sekarang pakai pendekatan inline:
  const { chromium } = await import('playwright')
  const { mkdirSync, writeFileSync, copyFileSync, readFileSync } = await import('node:fs')
  const { join, basename } = await import('node:path')
  const { PDFDocument } = await import('pdf-lib')
  const { renderPageHTML } = await import('./render/template.ts')

  const pagesDir = join(dir, 'pages')
  const webDir = join(dir, 'web')
  mkdirSync(pagesDir, { recursive: true })
  mkdirSync(join(webDir, 'pages'), { recursive: true })
  mkdirSync(join(webDir, 'audio'), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1240, height: 1653 },
    deviceScaleFactor: 1.5,
  })
  const page = await context.newPage()
  const pageImages: string[] = []

  for (const p of story.pages) {
    // Scene painterly per halaman (books/<slug>/scenes/page-NN.png) menang atas bgMap.
    const scene = join(dir, 'scenes', `page-${String(p.page_number).padStart(2, '0')}.png`)
    const bg = (existsSync(scene) ? scene : null)
      ?? bgMap.get(p.visual_scene.background_ref)
      ?? fallback
      ?? ''
    if (!bg) throw new Error(`Background tidak ditemukan: ${p.visual_scene.background_ref}`)
    const html = renderPageHTML(story, p, { ...assets, background: bg })
    const htmlFile = join(dir, 'scenes', `_render-page-${String(p.page_number).padStart(2, '0')}.html`)
    writeFileSync(htmlFile, html)
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'networkidle' })
    await page.waitForTimeout(120)
    const file = join(pagesDir, `page-${String(p.page_number).padStart(2, '0')}.png`)
    await page.screenshot({ path: file, type: 'png' })
    copyFileSync(file, join(webDir, 'pages', basename(file)))
    pageImages.push(file)
    console.log(`rendered page ${p.page_number}`)
  }

  const pdf = await PDFDocument.create()
  for (const imgPath of pageImages) {
    const img = await pdf.embedPng(readFileSync(imgPath))
    const pdfPage = pdf.addPage([1240, 1653])
    pdfPage.drawImage(img, { x: 0, y: 0, width: 1240, height: 1653 })
  }
  const pdfPath = join(dir, 'book.pdf')
  writeFileSync(pdfPath, await pdf.save())
  console.log('PDF →', pdfPath)

  // tulis reader dari render.ts (reuse fungsi)
  const { default: readerMod } = await import('./render/render.ts').then(() => ({ default: null }))
  // readerHTML tidak diexport; tulis ulang ringan:
  writeFileSync(join(webDir, 'book.json'), JSON.stringify(story, null, 2))
  await writeReader(join(webDir, 'index.html'), story)
  console.log('web →', join(webDir, 'index.html'))
  await browser.close()
}

async function writeReader(path: string, story: StoryBook): Promise<void> {
  const { readFileSync: rf } = await import('node:fs')
  // reuse template reader dari render.ts — untuk sementara salin dari renderBook
  const mod = await import('./render/render.ts')
  // readerHTML bersifat privat; kita tulis file reader minimal di sini
  // (render.ts punya implementasi lengkap — refactor nanti)
  const total = story.pages.length
  const titles = JSON.stringify(story.pages.map((p) => p.on_screen_text ?? story.book_meta.title))
  const html = rf(join(ROOT, 'templates', 'reader', 'reader.html'), 'utf8')
    .replace('__TOTAL__', String(total))
    .replace('__TITLES__', titles)
    .replace('__TITLE__', story.book_meta.title)
  writeFileSync(path, html)
}

function cmdQA(slug: string): void {
  const story = loadStory(slug)
  const issues = runQA(story)
  console.log(formatIssues(issues))
  if (issues.some((i) => i.level === 'error')) process.exitCode = 1
}

function cmdBudget(slug: string): void {
  const caps = loadCaps(join(bookDir(slug), 'budget.yaml'))
  const b = new Budget(caps, slug, budgetPathFor(bookDir(slug)), true)
  console.log(b.report())
}

function listBooks(): string[] {
  if (!existsSync(BOOKS)) return []
  return readdirSync(BOOKS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

async function main(): Promise<void> {
  const [cmd, slug] = process.argv.slice(2)
  switch (cmd) {
    case 'qa':
      if (!slug) throw new Error('pakai: cli.ts qa <slug>')
      cmdQA(slug)
      break
    case 'render':
      if (!slug) throw new Error('pakai: cli.ts render <slug>')
      await cmdRender(slug)
      break
    case 'budget':
      if (!slug) throw new Error('pakai: cli.ts budget <slug>')
      cmdBudget(slug)
      break
    case 'list':
      console.log(listBooks().join('\n') || '(belum ada buku)')
      break
    default:
      console.log(`BukuCeritaQ CLI
  bun run src/cli.ts qa <slug>       # validasi story.json + guardrail
  bun run src/cli.ts render <slug>   # render PNG + PDF + web
  bun run src/cli.ts budget <slug>   # laporan biaya
  bun run src/cli.ts list            # daftar buku`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
