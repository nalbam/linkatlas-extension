import { type StoredAnalysis } from '@/analysis/types'
import { type BookmarkNode } from '@/bookmarks/types'

/**
 * Pure path utilities for the organize working plan. A "path" is the chain of
 * folder segments *below* the 大 root (bookmark_bar / other) — the 大 root
 * itself is chosen at apply time, not stored here. Paths model both AI category
 * groupings (`[中, 小]`) and user purpose folders (arbitrary depth), told apart
 * by their {@link PathOrigin}.
 */

export const UNCATEGORIZED = 'Uncategorized'

export type PathOrigin = 'purpose' | 'category'
export type Segment = string
export type Path = Segment[]

/** Join key for Maps/overrides. NUL can't appear in a bookmark folder title. */
export const PATH_SEP = String.fromCharCode(0)
export const pathKey = (path: Path): string => path.join(PATH_SEP)
export const parsePathKey = (key: string): Path => (key === '' ? [] : key.split(PATH_SEP))

/** True when `path` starts with every segment of `prefix`. */
export function hasPrefix(path: Path, prefix: Path): boolean {
  if (prefix.length > path.length) return false
  return prefix.every((seg, i) => path[i] === seg)
}

/** Rebase `path` from one prefix to another (nested rename / merge). */
export function rebasePrefix(path: Path, from: Path, to: Path): Path {
  if (!hasPrefix(path, from)) return path
  return [...to, ...path.slice(from.length)]
}

type AnalysisMap = Record<string, StoredAnalysis>

/** The slice of OrganizeState that {@link effectivePath} reads. */
interface PathState {
  overrides: Record<string, Path>
  purposeRoots: readonly string[]
}

/**
 * Resolve where a bookmark belongs, as a path + origin:
 *   1. manual override (absolute)
 *   2. original folder path whose top segment is a purpose root → purpose (AI ignored)
 *   3. AI category `[category, subcategory]` (subcategory optional) → category
 *   4. original folder path, if any → category (preserved until AI re-classifies)
 *   5. `[UNCATEGORIZED]`
 */
export function effectivePath(
  bookmark: BookmarkNode,
  originalPathByUrl: Record<string, Path>,
  analysisByUrl: AnalysisMap,
  state: PathState,
): { path: Path; origin: PathOrigin } {
  const override = state.overrides[bookmark.id]
  if (override) {
    const isPurpose = override.length > 0 && state.purposeRoots.includes(override[0])
    return { path: override, origin: isPurpose ? 'purpose' : 'category' }
  }

  const original = originalPathByUrl[bookmark.id] ?? []
  if (original.length > 0 && state.purposeRoots.includes(original[0])) {
    return { path: original, origin: 'purpose' }
  }

  const analyzed = analysisByUrl[bookmark.url]
  if (analyzed?.status === 'ok' && analyzed.category) {
    const path = analyzed.subcategory ? [analyzed.category, analyzed.subcategory] : [analyzed.category]
    return { path, origin: 'category' }
  }

  if (original.length > 0) return { path: original, origin: 'category' }

  return { path: [UNCATEGORIZED], origin: 'category' }
}
