import { UNCATEGORIZED } from '@/organize/operations'
import { type CategoryGroup } from '@/organize/types'
import { type ApplyAssignment, type ApplyPlan } from './types'

/**
 * Build the apply preview from the current category grouping. Only real
 * categories with members are applied — Uncategorized and empty categories are
 * left untouched. `foldersToCreate` is an upper bound (the container + one per
 * category); at apply time same-named folders are reused.
 */
export function buildApplyPlan(groups: readonly CategoryGroup[]): ApplyPlan {
  const assignments: ApplyAssignment[] = groups
    .filter((g) => g.category !== UNCATEGORIZED && g.bookmarks.length > 0)
    .map((g) => ({ category: g.category, bookmarkIds: g.bookmarks.map((b) => b.id) }))

  const bookmarksToMove = assignments.reduce((n, a) => n + a.bookmarkIds.length, 0)
  const foldersToCreate = assignments.length === 0 ? 0 : assignments.length + 1

  return { assignments, foldersToCreate, bookmarksToMove }
}
