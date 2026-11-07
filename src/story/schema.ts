// Skema validasi story.json — dipakai oleh pipeline & QA.
import { z } from 'zod'

export const speakerSchema = z.enum(['qila', 'ezra', 'dalang', 'narrator'])
export const pageTypeSchema = z.enum([
  'cover',
  'story',
  'refrain',
  'climax',
  'closing',
])
export const layoutTypeSchema = z.enum([
  'cover',
  'story-bubble',
  'refrain',
  'hikmah',
  'closing',
])

export const bookMetaSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  concept: z.string().min(1),
  key_phrase: z.string().min(1),
  key_phrase_source: z.string().min(1),
  pillar: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  age_band: z.enum(['2-3', '4-5']),
  word_budget: z.number().int().positive(),
  sentence_pattern: z.string(),
  tagline: z.string().optional(),
  credit: z.string().optional(),
})

export const characterPlacementSchema = z.object({
  id: z.enum(['qila', 'ezra']),
  pose: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().positive(),
})

export const visualSceneSchema = z.object({
  background_ref: z.string().min(1),
  background_prompt: z.string().optional(),
  characters: z.array(characterPlacementSchema),
  props: z.array(z.string()),
})

export const dialogueLineSchema = z.object({
  speaker: speakerSchema,
  text: z.string().min(1),
  narration_text: z.string().optional(),
  bubble: z.enum(['a', 'b']).optional(),
})

export const pageSchema = z.object({
  page_number: z.number().int().positive(),
  page_type: pageTypeSchema,
  layout_type: layoutTypeSchema,
  visual_scene: visualSceneSchema,
  dialogue: z.array(dialogueLineSchema),
  on_screen_text: z.string().optional(),
  dalang_note: z.string().optional(),
  repeats_of: z.number().int().positive().nullable().optional(),
})

export const storyBookSchema = z.object({
  book_meta: bookMetaSchema,
  style_lock: z.object({
    style_refs: z.array(z.string()),
    seed: z.number(),
    palette: z.record(z.string(), z.string()),
  }),
  pages: z.array(pageSchema).min(1).max(12),
})

export type StoryBookParsed = z.infer<typeof storyBookSchema>
