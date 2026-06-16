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

type AnalysisMap = Record<string, StoredAnalysis>
type MetadataMap = Record<string, BookmarkMetadata>

export interface RecategorizeRequest {
  inputs: RecategorizeInput[]
  /** url for each input, indexed identically — used to map assignments back. */
  urlByIndex: string[]
}

/**
 * Build the recategorization request from the category-eligible bookmarks.
 * Purpose-group bookmarks (original top folder ∈ purposeRoots) are excluded so
 * the user's intentional folders are left untouched.
 */
export function buildRecategorizeInputs(
  bookmarks: readonly BookmarkNode[],
  originalPathByUrl: Record<string, string[]>,
  purposeRoots: readonly string[],
  metadataByUrl: MetadataMap,
): RecategorizeRequest {
  const inputs: RecategorizeInput[] = []
  const urlByIndex: string[] = []
  for (const bookmark of bookmarks) {
    const original = originalPathByUrl[bookmark.url] ?? []
    if (original.length > 0 && purposeRoots.includes(original[0])) continue
    const meta = metadataByUrl[bookmark.url]
    const hintRaw = meta?.description ?? meta?.ogDescription
    const hint = hintRaw ? hintRaw.trim().slice(0, HINT_MAX) : undefined
    inputs.push({
      title: bookmark.title || meta?.title || meta?.ogTitle || bookmark.url,
      domain: bookmark.domain,
      hint: hint || undefined,
    })
    urlByIndex.push(bookmark.url)
  }
  return { inputs, urlByIndex }
}

/**
 * Fold assignments into StoredAnalysis records, updating only category +
 * subcategory and preserving any existing summary/importance/tags/reason.
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
