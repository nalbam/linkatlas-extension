/**
 * Types for applying the category working state to real Chrome bookmarks.
 * The apply step is destructive (it moves bookmarks), so it always runs behind a
 * preview + confirm gate and records a snapshot for rollback.
 */

export interface ApplyAssignment {
  /** The 大 root id (bookmark_bar / other) to create `path` under. */
  rootId: string
  /** Folder segments to ensure (in order) under the root — e.g. ['karrot','pay']. */
  path: string[]
  /** Chrome bookmark ids to place under this path's terminal folder. */
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

