import {
  filterByDomain,
  flattenVisible,
  searchTree,
  sortTree,
} from '@/bookmarks/tree'
import { type BookmarkId, type FlatNode, type SortKey, type TreeNode } from '@/bookmarks/types'

export interface ViewState {
  searchQuery: string
  domainFilter: string
  sortKey: SortKey
  expandedIds: ReadonlySet<BookmarkId>
}

/**
 * The single derivation pipeline from raw tree → rendered rows:
 *   domain filter → text search → sort → flatten (windowed).
 * Pure and memoizable. When a filter/search is active, folders auto-expand so
 * matches are never hidden behind a collapsed parent.
 */
export function selectVisibleRows(
  roots: readonly TreeNode[],
  view: ViewState,
): FlatNode[] {
  const isFiltering = view.searchQuery.trim() !== '' || view.domainFilter !== ''

  let tree: readonly TreeNode[] = roots
  if (view.domainFilter) tree = filterByDomain(tree, view.domainFilter)
  if (view.searchQuery.trim()) tree = searchTree(tree, view.searchQuery)
  tree = sortTree(tree, view.sortKey)

  return flattenVisible(tree, view.expandedIds, { expandAll: isFiltering })
}
