// Budget tracker: cap biaya per buku + cost-log.jsonl.
// Semua pemanggilan API WAJIB lewat Budget.charge().
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { BudgetCaps, CostEntry } from '../types.ts'

export class BudgetExceededError extends Error {
  constructor(
    public category: string,
    public cap: number,
    public spent: number,
  ) {
    super(
      `Budget exceeded for ${category}: spent $${spent.toFixed(4)} of cap $${cap.toFixed(4)}`,
    )
    this.name = 'BudgetExceededError'
  }
}

export class Budget {
  private spent: Record<'llm' | 'image' | 'tts', number> = { llm: 0, image: 0, tts: 0 }
  private totalSpent = 0

  constructor(
    public caps: BudgetCaps,
    public bookSlug: string,
    public logPath: string,
    public dryRun = false,
  ) {
    this.loadSpent()
  }

  static defaultCaps(): BudgetCaps {
    return { llm: 0.05, image: 2.0, tts: 0.3, total: 2.5 }
  }

  private loadSpent(): void {
    if (!existsSync(this.logPath)) return
    const lines = readFileSync(this.logPath, 'utf8').trim().split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line) as CostEntry
        if (e.book !== this.bookSlug) continue
        if (e.category in this.spent) {
          this.spent[e.category] += e.usd
          this.totalSpent += e.usd
        }
      } catch {
        // baris rusak diabaikan
      }
    }
  }

  spentSoFar(): { llm: number; image: number; tts: number; total: number } {
    return { ...this.spent, total: this.totalSpent }
  }

  /** Cek apakah penambahan `usd` pada `category` masih di bawah cap. */
  check(category: 'llm' | 'image' | 'tts', usd: number): void {
    const catCap = this.caps[category]
    const catSpent = this.spent[category] + usd
    if (catSpent > catCap) throw new BudgetExceededError(category, catCap, this.spent[category])
    const total = this.totalSpent + usd
    if (total > this.caps.total) throw new BudgetExceededError('total', this.caps.total, this.totalSpent)
  }

  /** Catat biaya. Dalam dry-run tidak ditulis ke log. */
  charge(entry: Omit<CostEntry, 'ts' | 'book' | 'usd'> & { usd: number }): void {
    this.check(entry.category, entry.usd)
    if (this.dryRun) {
      console.log(`[dry-run] ${entry.category} ${entry.provider}/${entry.model}: $${entry.usd.toFixed(4)} — ${entry.detail}`)
      return
    }
    const full: CostEntry = {
      ts: new Date().toISOString(),
      book: this.bookSlug,
      ...entry,
    }
    mkdirSync(dirname(this.logPath), { recursive: true })
    appendFileSync(this.logPath, JSON.stringify(full) + '\n')
    this.spent[entry.category] += entry.usd
    this.totalSpent += entry.usd
    console.log(`[cost] ${entry.category}: $${entry.usd.toFixed(4)} (total $${this.totalSpent.toFixed(4)})`)
  }

  report(): string {
    const s = this.spentSoFar()
    return `Budget ${this.bookSlug}: llm $${s.llm.toFixed(4)}/${this.caps.llm} · image $${s.image.toFixed(4)}/${this.caps.image} · tts $${s.tts.toFixed(4)}/${this.caps.tts} · total $${s.total.toFixed(4)}/${this.caps.total}`
  }
}

export function loadCaps(overridePath?: string): BudgetCaps {
  const base = Budget.defaultCaps()
  if (!overridePath || !existsSync(overridePath)) return base
  const raw = readFileSync(overridePath, 'utf8')
  const parsed = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const out = { ...base }
  for (const line of parsed) {
    const m = line.match(/^(\w+):\s*([\d.]+)$/)
    if (!m) continue
    const key = m[1] as keyof BudgetCaps
    if (key in out) out[key] = parseFloat(m[2]!)
  }
  return out
}

export function budgetPathFor(bookDir: string): string {
  return join(bookDir, 'cost-log.jsonl')
}
