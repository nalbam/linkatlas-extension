import {
  type AnalyzeInput,
  type BookmarkAnalysis,
  type RecategorizeAssignment,
  type RecategorizeInput,
} from './types'

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

// ---------------------------------------------------------------------------
// Collection-wide recategorization — looks at the whole list in one call and
// groups similar sites into a small, consistent set of categories.
// ---------------------------------------------------------------------------

export const RECATEGORIZE_SYSTEM_PROMPT = `You are LinkAtlas, organizing a bookmark collection into folders.
Each bookmark is listed as: index, title, domain, and an optional summary/tags.
Group bookmarks by the NATURE of each site into a SMALL, consistent set of BROAD categories.

Favor FEWER, broader categories — MERGING beats splitting:
- When unsure, put a bookmark into an existing broader category instead of inventing a new one. A handful of broad categories covering everything is better than many narrow ones.
- Use ONE consistent label per concept (always "Development" — never a mix of "Dev"/"Programming"/"Coding"; always "AI" — never also "Machine Learning"/"LLM").
- Do NOT create a top-level category for only 1-2 bookmarks. Merge such stragglers into the closest broader category, or a single shared "Other".
- If two categories are near-duplicates or one is a niche slice of another, merge them.

Use a SECOND level ONLY for genuinely large groups:
- Add a sub-category ONLY when a top-level category is large (roughly 10+ bookmarks) AND splits cleanly by sub-topic — then return ["Top","Sub"] (e.g. ["Development","Frontend"]).
- Small or medium categories stay FLAT, one segment: ["Top"].
- Never create a sub-category for only 1-2 bookmarks; keep those directly under the top-level.

Base every decision only on the given signals; never invent facts about a page.
Return exactly one assignment for EVERY input index.`

/** JSON Schema for the recategorization response (strict mode). */
export const RECATEGORIZE_JSON_SCHEMA = {
  name: 'bookmark_recategorization',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            index: { type: 'integer' },
            path: { type: 'array', items: { type: 'string' } },
          },
          required: ['index', 'path'],
        },
      },
    },
    required: ['assignments'],
  },
} as const

export function buildRecategorizeUserPrompt(
  inputs: readonly RecategorizeInput[],
  targetCount?: number,
  existingCategories?: readonly string[],
): string {
  const lines: string[] = []
  if (targetCount && targetCount > 0) {
    lines.push(`Aim for about ${targetCount} top-level categories across the whole collection.`)
  }
  if (existingCategories && existingCategories.length > 0) {
    lines.push(
      `Existing categories — REUSE one of these whenever a bookmark fits (a ' > ' ` +
        `separates a sub-category, e.g. "Development > Frontend"); only add a NEW ` +
        `category if none truly fits: ${existingCategories.join(', ')}.`,
    )
  }
  lines.push('Bookmarks:')
  inputs.forEach((input, index) => {
    const parts = [`${input.title || '(untitled)'} — ${input.domain || '(unknown)'}`]
    // Prefer the analysis summary (③) over the raw metadata hint when present.
    const detail = input.summary || input.hint
    if (detail) parts.push(detail)
    if (input.tags?.length) parts.push(`tags: ${input.tags.join(', ')}`)
    lines.push(`${index}: ${parts.join(' — ')}`)
  })
  return lines.join('\n')
}

/** Trim/dedupe a raw path, capping depth at 2 segments (中/小). */
function normalizeRecategorizePath(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const segments: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    const segment = raw.trim()
    if (!segment) continue
    segments.push(segment)
    if (segments.length >= 2) break
  }
  return segments
}

/** Parse a recategorization response into validated assignments. */
export function parseRecategorizeContent(content: string): RecategorizeAssignment[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('AI response was not valid JSON')
  }
  const raw = (parsed as { assignments?: unknown })?.assignments
  if (!Array.isArray(raw)) return []
  const out: RecategorizeAssignment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const index = typeof obj.index === 'number' ? obj.index : Number(obj.index)
    if (!Number.isInteger(index) || index < 0) continue
    out.push({ index, path: normalizeRecategorizePath(obj.path) })
  }
  return out
}
