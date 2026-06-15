/**
 * Types for applying the category working state to real Chrome bookmarks.
 * The apply step is destructive (it moves bookmarks), so it always runs behind a
 * preview + confirm gate and records a snapshot for rollback.
 */

export interface ApplyAssignment {
  category: string
  /** Chrome bookmark ids to place under this category's folder. */
  bookmarkIds: string[]
}

/** Preview shown before applying (upper bounds — existing folders are reused). */
export interface ApplyPlan {
  assignments: ApplyAssignment[]
  foldersToCreate: number
  bookmarksToMove: number
}

export interface MovedBookmark {
  id: string
  parentId: string
  index: number
}

/** Captured during apply so the changes can be rolled back. */
export interface ApplySnapshot {
  moved: MovedBookmark[]
  createdFolderIds: string[]
}

export interface ApplySummary {
  categories: number
  created: number
  moved: number
}

export interface ApplyTarget {
  /** Top-level folder id the container is created under. */
  parentId: string
  /** Container folder name (e.g. "LinkAtlas"). */
  container: string
}
