import { getBookmarkRoots } from '@/bookmarks/chromeBookmarks'
import { type TreeNode } from '@/bookmarks/types'

/** Stable query keys for the bookmark data owned by TanStack Query. */
export const bookmarkKeys = {
  all: ['bookmarks'] as const,
  tree: ['bookmarks', 'tree'] as const,
}

/**
 * Load the full bookmark forest from Chrome. Framework-agnostic so it can be
 * driven by a React Query hook in the UI or called directly from the worker.
 */
export function loadBookmarkTree(): Promise<TreeNode[]> {
  return getBookmarkRoots()
}
