import { normalizeAnalysis } from '@/ai/prompts'
import { type RecategorizeAssignment, type RecategorizeInput } from '@/ai/types'
import { type BookmarkNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { type StoredAnalysis } from './types'

/**
 * Pure transforms for collection-wide recategorization: select the eligible
 * bookmarks + build the model input, and fold the model's assignments back into
 * StoredAnalysis records (touching only category/subcategory).
 */

const HINT_MAX = 100
const TAGS_MAX = 5

type AnalysisMap = Record<string, StoredAnalysis>
type MetadataMap = Record<string, BookmarkMetadata>

export interface RecategorizeRequest {
  inputs: RecategorizeInput[]
  /** url for each input, indexed identically — used to map assignments back. */
  urlByIndex: string[]
}

/**
 * Build the recategorization request from the category-eligible bookmarks.
 * Excluded (left to manual management): bookmarks whose effective 大 root is in
 * `excludeRootTitles` (e.g. the bookmark bar) and purpose-group bookmarks
 * (original top folder ∈ purposeRoots).
 *
 * When per-bookmark analysis (③) exists, its summary/tags are passed as richer
 * grouping signal (the prompt prefers the summary over the raw metadata hint).
 */
export function buildRecategorizeInputs(
  bookmarks: readonly BookmarkNode[],
  originalPathById: Record<string, string[]>,
  rootTitleById: Record<string, string>,
  purposeRoots: readonly string[],
  excludeRootTitles: readonly string[],
  metadataByUrl: MetadataMap,
  analysisByUrl: AnalysisMap = {},
): RecategorizeRequest {
  const excludedRoots = new Set(excludeRootTitles)
  const inputs: RecategorizeInput[] = []
  const urlByIndex: string[] = []
  for (const bookmark of bookmarks) {
    if (excludedRoots.has(rootTitleById[bookmark.id] ?? '')) continue
    const original = originalPathById[bookmark.id] ?? []
    if (original.length > 0 && purposeRoots.includes(original[0])) continue
    const meta = metadataByUrl[bookmark.url]
    const hintRaw = meta?.description ?? meta?.ogDescription
    const hint = hintRaw ? hintRaw.trim().slice(0, HINT_MAX) : undefined
    const analysis = analysisByUrl[bookmark.url]
    const summary =
      analysis?.status === 'ok' && analysis.summary
        ? analysis.summary.trim().slice(0, HINT_MAX)
        : undefined
    const tags =
      analysis?.status === 'ok' && analysis.tags.length ? analysis.tags.slice(0, TAGS_MAX) : undefined
    inputs.push({
      title: bookmark.title || meta?.title || meta?.ogTitle || bookmark.url,
      domain: bookmark.domain,
      hint: hint || undefined,
      summary,
      tags,
    })
    urlByIndex.push(bookmark.url)
  }
  return { inputs, urlByIndex }
}

/**
 * Fold assignments into StoredAnalysis records, updating only category +
 * subcategory and preserving any existing summary/importance/tags/reason. When no
 * analysis exists yet, the new record is marked `summarized: false` — it carries a
 * category but no per-bookmark signal, so it stays eligible for analysis (③) and
 * doesn't pollute the Tree's category/tag views as a "fake" analyzed bookmark.
 */
export function applyRecategorize(
  assignments: readonly RecategorizeAssignment[],
  urlByIndex: readonly string[],
  analysisByUrl: AnalysisMap,
  model: string,
  now: number,
): StoredAnalysis[] {
  const out: StoredAnalysis[] = []
  for (const { index, path } of assignments) {
    const url = urlByIndex[index]
    if (!url) continue
    const existing = analysisByUrl[url]
    const base: StoredAnalysis = existing ?? {
      ...normalizeAnalysis({}),
      url,
      status: 'ok',
      analyzedAt: now,
      model,
      summarized: false,
    }
    out.push({
      ...base,
      url,
      category: path[0] ?? '',
      subcategory: path[1] ?? '',
      status: 'ok',
      analyzedAt: now,
      model,
    })
  }
  return out
}
