// Tipe inti pipeline BukuCeritaQ. Sumber kebenaran skema cerita.

export type AgeBand = '2-3' | '4-5'
export type Pillar = 1 | 2 | 3
export type PageType = 'cover' | 'story' | 'refrain' | 'climax' | 'closing'
export type LayoutType =
  | 'cover'
  | 'story-bubble'
  | 'refrain'
  | 'hikmah'
  | 'closing'
export type Speaker = 'qila' | 'ezra' | 'dalang' | 'narrator'

export interface BookMeta {
  slug: string
  title: string
  concept: string
  key_phrase: string
  key_phrase_source: string
  pillar: Pillar
  age_band: AgeBand
  word_budget: number
  sentence_pattern: string
  tagline?: string
  credit?: string
}

export interface StyleLock {
  style_refs: string[]
  seed: number
  palette: Record<string, string>
}

export interface CharacterPlacement {
  id: 'qila' | 'ezra'
  pose: string
  x: number // 0..1 relatif lebar halaman
  y: number // 0..1 relatif tinggi halaman (titik kaki)
  scale: number
}

export interface VisualScene {
  background_ref: string
  background_prompt?: string
  characters: CharacterPlacement[]
  props: string[]
}

export interface DialogueLine {
  speaker: Speaker
  text: string
  narration_text?: string
  bubble?: 'a' | 'b'
}

export interface Page {
  page_number: number
  page_type: PageType
  layout_type: LayoutType
  visual_scene: VisualScene
  dialogue: DialogueLine[]
  on_screen_text?: string
  dalang_note?: string
  repeats_of?: number | null
}

export interface StoryBook {
  book_meta: BookMeta
  style_lock: StyleLock
  pages: Page[]
}

export interface BudgetCaps {
  llm: number
  image: number
  tts: number
  total: number
}

export interface CostEntry {
  ts: string
  book: string
  category: 'llm' | 'image' | 'tts'
  provider: string
  model: string
  detail: string
  usd: number
}
