// QA checklist otomatis untuk story.json (PLAN.md §6).
// Mengembalikan daftar pelanggaran; kosong = lolos.
import type { StoryBook } from '../types.ts'

export interface QAIssue {
  level: 'error' | 'warn'
  page?: number
  rule: string
  message: string
}

const FORBIDDEN_CHILD_LEXICON = [
  'nakal',
  'jahat',
  'azab',
  'neraka',
  'dosa',
  'Allah akan marah',
  'dihukum',
  'malang',
  'celaka',
]

const TWEET_RE = /\b(https?:\/\/|@\w+)/

export function runQA(book: StoryBook): QAIssue[] {
  const issues: QAIssue[] = []
  const { book_meta: meta, pages } = book

  // R1: frasa kunci maksimal 1 per buku — dicek via kemunculan di on_screen_text/dialogue
  // (konsep saja, bukan verifikasi semantik).

  // R2: leksikon malu/takut dilarang di teks anak
  for (const page of pages) {
    const childTexts = [
      page.on_screen_text ?? '',
      ...page.dialogue.map((d) => d.text),
    ].join(' ')
    for (const bad of FORBIDDEN_CHILD_LEXICON) {
      if (childTexts.toLowerCase().includes(bad.toLowerCase())) {
        issues.push({
          level: 'error',
          page: page.page_number,
          rule: 'no-shame-fear-lexicon',
          message: `Teks anak mengandung "${bad}" — dilarang (guardrail §6)`,
        })
      }
    }
    if (TWEET_RE.test(childTexts)) {
      issues.push({
        level: 'warn',
        page: page.page_number,
        rule: 'no-links-in-child-text',
        message: 'Teks anak mengandung link/mention',
      })
    }
  }

  // R3: jumlah kata per halaman sesuai band usia
  const maxWordsPerPage = meta.age_band === '2-3' ? 12 : 25
  const minWordsPerPage = meta.age_band === '2-3' ? 1 : 3
  for (const page of pages) {
    if (page.page_type === 'cover') continue
    const words = countWords(
      page.dialogue.map((d) => d.text).join(' ') + ' ' + (page.on_screen_text ?? ''),
    )
    if (words > maxWordsPerPage) {
      issues.push({
        level: 'error',
        page: page.page_number,
        rule: 'word-budget',
        message: `${words} kata di halaman ${page.page_number} (maks ${maxWordsPerPage} untuk usia ${meta.age_band})`,
      })
    }
    if (page.page_type === 'story' && words < minWordsPerPage) {
      issues.push({
        level: 'warn',
        page: page.page_number,
        rule: 'word-budget',
        message: `Hanya ${words} kata di halaman ${page.page_number} (min ${minWordsPerPage})`,
      })
    }
  }

  // R4: total kata buku
  const totalWords = pages.reduce(
    (n, p) =>
      n +
      countWords(p.dialogue.map((d) => d.text).join(' ') + ' ' + (p.on_screen_text ?? '')),
    0,
  )
  const maxTotal = meta.age_band === '2-3' ? 200 : 400
  if (totalWords > maxTotal) {
    issues.push({
      level: 'error',
      rule: 'book-word-budget',
      message: `Total ${totalWords} kata (maks ${maxTotal} untuk usia ${meta.age_band})`,
    })
  }

  // R5: balon kata ≤ 10 kata, maks 2 dialog per halaman
  for (const page of pages) {
    if (page.dialogue.length > 2) {
      issues.push({
        level: 'error',
        page: page.page_number,
        rule: 'max-2-dialogues',
        message: `${page.dialogue.length} dialog di halaman ${page.page_number} (maks 2)`,
      })
    }
    for (const d of page.dialogue) {
      const w = countWords(d.text)
      if (w > 10) {
        issues.push({
          level: 'error',
          page: page.page_number,
          rule: 'bubble-word-cap',
          message: `Balon ${d.speaker} ${w} kata (maks 10)`,
        })
      }
    }
  }

  // R6: Box Hikmah harus ada (halaman hikmah/closing punya dalang_note)
  const hikmahPage = pages.find((p) => p.layout_type === 'hikmah')
  if (!hikmahPage) {
    issues.push({ level: 'error', rule: 'hikmah-required', message: 'Tidak ada halaman Box Hikmah Dalang' })
  } else if (!hikmahPage.dalang_note || hikmahPage.dalang_note.length < 10) {
    issues.push({ level: 'error', page: hikmahPage.page_number, rule: 'hikmah-content', message: 'Box Hikmah kosong/terlalu pendek' })
  }

  // R7: sumber frasa kunci wajib ada di metadata (bukan di teks anak)
  if (!meta.key_phrase_source || meta.key_phrase_source.length < 5) {
    issues.push({ level: 'error', rule: 'phrase-source-required', message: 'key_phrase_source kosong' })
  }

  // R8: jumlah halaman 10 (atau 8-12 dengan warning)
  if (pages.length !== 10) {
    issues.push({
      level: pages.length >= 8 && pages.length <= 12 ? 'warn' : 'error',
      rule: 'page-count',
      message: `${pages.length} halaman (target 10)`,
    })
  }

  // R9: nomor halaman berurutan
  pages.forEach((p, i) => {
    if (p.page_number !== i + 1) {
      issues.push({
        level: 'error',
        page: p.page_number,
        rule: 'page-numbering',
        message: `Halaman ke-${i + 1} bernomor ${p.page_number}`,
      })
    }
  })

  // R10: Ezra punya adegan mencoba (bukan hanya gagal) — heuristik: ada page_type story/climax
  // dengan ezra berdialog setelah page wobble.
  const ezraSpeaks = pages.some((p) => p.dialogue.some((d) => d.speaker === 'ezra'))
  if (!ezraSpeaks) {
    issues.push({ level: 'warn', rule: 'ezra-agency', message: 'Ezra tidak berdialog sama sekali' })
  }

  return issues
}

function countWords(s: string): number {
  return s
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

export function formatIssues(issues: QAIssue[]): string {
  if (issues.length === 0) return 'QA: semua pemeriksaan lolos ✓'
  return issues
    .map((i) => `[${i.level.toUpperCase()}] ${i.rule}${i.page ? ` (hal ${i.page})` : ''}: ${i.message}`)
    .join('\n')
}
