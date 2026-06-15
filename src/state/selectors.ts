import { type StoredAnalysis } from '@/analysis/types'
import {
  collectBookmarks,
  filterByDomain,
  filterTree,
  flattenVisible,
  searchTree,
  sortTree,
} from '@/bookmarks/tree'
import {
  type BookmarkId,
  type BookmarkNode,
  type FlatNode,
  type SortKey,
  type TreeNode,
} from '@/bookmarks/types'

export interface ViewState {
  searchQuery: string
  domainFilter: string
  categoryFilter: string
  tagFilter: string
  sortKey: SortKey
  expandedIds: ReadonlySet<BookmarkId>
}

type AnalysisMap = Record<string, StoredAnalysis>

function isFiltering(view: ViewState): boolean {
  return (
    view.searchQuery.trim() !== '' ||
    view.domainFilter !== '' ||
    view.categoryFilter !== '' ||
    view.tagFilter !== ''
  )
}

/** Apply domain / category / tag / search filters (no sort, no flatten). */
function applyFilters(
  roots: readonly TreeNode[],
  view: ViewState,
  analysisByUrl: AnalysisMap,
): readonly TreeNode[] {
  let tree: readonly TreeNode[] = roots
  if (view.domainFilter) tree = filterByDomain(tree, view.domainFilter)
  if (view.categoryFilter) {
    tree = filterTree(tree, {
      matchBookmark: (b) => analysisByUrl[b.url]?.category === view.categoryFilter,
    })
  }
  if (view.tagFilter) {
    tree = filterTree(tree, {
      matchBookmark: (b) => analysisByUrl[b.url]?.tags.includes(view.tagFilter) ?? false,
    })
  }
  if (view.searchQuery.trim()) tree = searchTree(tree, view.searchQuery)
  return tree
}

/**
 * The single derivation pipeline from raw tree → rendered rows:
 *   filters → sort → flatten (windowed). Category, tag, and importance read from
 *   the analysis map (keyed by URL), passed in so this stays pure and
 *   memoizable. When any filter/search is active, folders auto-expand so matches
 *   are never hidden.
 */
export function selectVisibleRows(
  roots: readonly TreeNode[],
  view: ViewState,
  analysisByUrl: AnalysisMap = {},
): FlatNode[] {
  const tree = sortTree(applyFilters(roots, view, analysisByUrl), view.sortKey, {
    importanceOf: (b) => analysisByUrl[b.url]?.importance ?? -1,
  })
  return flattenVisible(tree, view.expandedIds, { expandAll: isFiltering(view) })
}

/**
 * Bookmarks matching the current filters, regardless of expand state — the scope
 * for actions like "analyze these". Sort/flatten are irrelevant here.
 */
export function selectFilteredBookmarks(
  roots: readonly TreeNode[],
  view: ViewState,
  analysisByUrl: AnalysisMap = {},
): BookmarkNode[] {
  return collectBookmarks(applyFilters(roots, view, analysisByUrl))
}
