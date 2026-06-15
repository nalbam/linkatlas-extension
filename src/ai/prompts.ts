import { type AnalyzeInput, type BookmarkAnalysis } from './types'

/**
 * Prompt + schema + response normalization for bookmark analysis. Kept separate
 * from any single provider so OpenAI / Gemini / Claude can share one contract,
 * and so the pure transforms are unit-testable without a network call.
 */

export const SYSTEM_PROMPT = `You are LinkAtlas, an assistant that organizes web bookmarks.
For a single bookmark you receive its title, URL and any available metadata.
Return a concise, structured analysis:
- summary: one neutral sentence describing what the page is.
- category: a broad, self-inferred top-level category (e.g. Development, AI, Finance, Learning). Do NOT pick from a fixed list — infer the most natural label.
- subcategory: a more specific grouping under the category.
- tags: 3-8 short semantic / technology / topic tags (e.g. React, Kubernetes, Startup). No duplicates, no '#'.
- importance: integer 0-10 reflecting likely long-term usefulness.
- reason: a short justification for the category and importance.
Base every field only on the provided signals; never invent facts about the page.`

/** JSON Schema for OpenAI-style Structured Outputs (strict mode). */
export const ANALYSIS_JSON_SCHEMA = {
  name: 'bookmark_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      category: { type: 'string' },
      subcategory: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      importance: { type: 'integer', minimum: 0, maximum: 10 },
      reason: { type: 'string' },
    },
    required: ['summary', 'category', 'subcategory', 'tags', 'importance', 'reason'],
  },
} as const

export function buildUserPrompt(input: AnalyzeInput): string {
  const lines = [
    `Title: ${input.title || '(none)'}`,
    `URL: ${input.url}`,
    `Domain: ${input.domain || '(unknown)'}`,
  ]
  if (input.description) lines.push(`Description: ${input.description}`)
  if (input.keywords?.length) lines.push(`Keywords: ${input.keywords.join(', ')}`)
  return lines.join('\n')
}

const MAX_TAGS = 12

function clampImportance(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(10, Math.max(0, Math.round(n)))
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().replace(/^#/, '')
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

/** Defensive coercion of a raw model object into a valid BookmarkAnalysis. */
export function normalizeAnalysis(raw: unknown): BookmarkAnalysis {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const category = str(obj.category) || 'Uncategorized'
  return {
    summary: str(obj.summary),
    category,
    subcategory: str(obj.subcategory),
    tags: normalizeTags(obj.tags),
    importance: clampImportance(obj.importance),
    reason: str(obj.reason),
  }
}

/** Parse a model's JSON string content into a normalized analysis. */
export function parseAnalysisContent(content: string): BookmarkAnalysis {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('AI response was not valid JSON')
  }
  return normalizeAnalysis(parsed)
}
