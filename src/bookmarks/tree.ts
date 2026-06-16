/**
 * Pure tree utilities — no Chrome APIs, no React. Everything here is
 * deterministic and unit-tested so the heavy lifting (search, filter, sort,
 * flatten-for-virtualization) stays fast and verifiable for 10k+ nodes.
 */

import {
  type BookmarkId,
  type BookmarkNode,
  type FlatNode,
  type FolderNode,
  type SortKey,
  type TreeNode,
  isFolder,
} from './types'

/** Extract a normalised, www-stripped hostname; empty string when unparseable. */
export function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

export interface TreeCounts {
  folders: number
  bookmarks: number
}

export function countTree(roots: readonly TreeNode[]): TreeCounts {
  let folders = 0
  let bookmarks = 0
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (isFolder(node)) {
        folders += 1
        walk(node.children)
      } else {
        bookmarks += 1
      }
    }
  }
  walk(roots)
  return { folders, bookmarks }
}

/** Unique, sorted, non-empty domains across every bookmark in the tree. */
export function collectDomains(roots: readonly TreeNode[]): string[] {
  const set = new Set<string>()
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (isFolder(node)) walk(node.children)
      else if (node.domain) set.add(node.domain)
    }
  }
  walk(roots)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Unique bookmark URLs across the tree (used to scope metadata collection). */
export function collectBookmarkUrls(roots: readonly TreeNode[]): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (isFolder(node)) walk(node.children)
      else if (!seen.has(node.url)) {
        seen.add(node.url)
        urls.push(node.url)
      }
    }
  }
  walk(roots)
  return urls
}

/** All bookmark nodes in the tree, in depth-first order. */
export function collectBookmarks(roots: readonly TreeNode[]): BookmarkNode[] {
  const out: BookmarkNode[] = []
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (isFolder(node)) walk(node.children)
      else out.push(node)
    }
  }
  walk(roots)
  return out
}

/** All folder ids in the tree — used to drive "expand all". */
export function collectFolderIds(roots: readonly TreeNode[]): BookmarkId[] {
  const ids: BookmarkId[] = []
  const walk = (nodes: readonly TreeNode[]) => {
    for (const node of nodes) {
      if (isFolder(node)) {
        ids.push(node.id)
        walk(node.children)
      }
    }
  }
  walk(roots)
  return ids
}

/**
 * Map each bookmark url to its ancestor folder titles *below* the 大 root —
 * the root's own title is excluded, so a bookmark at `bookmark_bar/karrot/pay/x`
 * yields `['karrot','pay']` and a loose `bookmark_bar/x` yields `[]`. First
 * occurrence wins (matches {@link collectBookmarkUrls}). Used to preserve the
 * user's existing purpose folders when organizing.
 */
export function collectOriginalPaths(roots: readonly TreeNode[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const walk = (nodes: readonly TreeNode[], trail: string[]) => {
    for (const node of nodes) {
      if (isFolder(node)) walk(node.children, [...trail, node.title])
      else if (!(node.url in out)) out[node.url] = trail
    }
  }
  for (const root of roots) {
    if (isFolder(root)) walk(root.children, [])
  }
  return out
}

/** Child folder titles of one root — used to seed purpose roots from the bar. */
export function topLevelFolderTitles(root: TreeNode | undefined): string[] {
  if (!root || !isFolder(root)) return []
  return root.children.filter(isFolder).map((folder) => folder.title)
}

/**
 * Map each bookmark url to its top-level 大 root title (the root it lives under).
 * First occurrence wins. Pairs with {@link collectOriginalPaths} (which excludes
 * the 大) so organize can render and apply per browser root.
 */
export function collectRootTitleByUrl(roots: readonly TreeNode[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const root of roots) {
    if (!isFolder(root)) continue
    const walk = (nodes: readonly TreeNode[]) => {
      for (const node of nodes) {
        if (isFolder(node)) walk(node.children)
        else if (!(node.url in out)) out[node.url] = root.title
      }
    }
    walk(root.children)
  }
  return out
}

export interface FilterMatchers {
  /** Keep a bookmark leaf when this returns true. */
  matchBookmark: (node: BookmarkNode) => boolean
  /** When provided and true for a folder, the whole subtree is kept verbatim. */
  matchFolder?: (node: FolderNode) => boolean
}

/**
 * Prune the tree to nodes that match. A folder survives when it matches
 * directly (whole subtree kept) or when at least one descendant survives.
 * Returns new node objects (immutable) — inputs are never mutated.
 */
export function filterTree(roots: readonly TreeNode[], matchers: FilterMatchers): TreeNode[] {
  const { matchBookmark, matchFolder } = matchers
  const visit = (node: TreeNode): TreeNode | null => {
    if (!isFolder(node)) {
      return matchBookmark(node) ? node : null
    }
    if (matchFolder?.(node)) return node
    const children = node.children.map(visit).filter((n): n is TreeNode => n !== null)
    return children.length > 0 ? { ...node, children } : null
  }
  return roots.map(visit).filter((n): n is TreeNode => n !== null)
}

/** Case-insensitive search across bookmark title, url and domain. */
export function searchTree(roots: readonly TreeNode[], rawQuery: string): TreeNode[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return [...roots]
  return filterTree(roots, {
    matchBookmark: (b) =>
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      b.domain.includes(query),
    matchFolder: (f) => f.title.toLowerCase().includes(query),
  })
}

/** Keep only bookmarks belonging to a specific domain (plus ancestor folders). */
export function filterByDomain(roots: readonly TreeNode[], domain: string): TreeNode[] {
  if (!domain) return [...roots]
  return filterTree(roots, { matchBookmark: (b) => b.domain === domain })
}

export interface SortOptions {
  /** Importance (0–10) for a bookmark; used only by the 'importance' key. */
  importanceOf?: (bookmark: BookmarkNode) => number
}

function compareNodes(a: TreeNode, b: TreeNode, key: SortKey, options: SortOptions): number {
  // Folders always render above bookmarks regardless of key.
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title)
    case 'domain': {
      const da = a.type === 'bookmark' ? a.domain : a.title.toLowerCase()
      const db = b.type === 'bookmark' ? b.domain : b.title.toLowerCase()
      return da.localeCompare(db) || a.title.localeCompare(b.title)
    }
    case 'recent':
      return (b.dateAdded ?? 0) - (a.dateAdded ?? 0)
    case 'importance': {
      if (a.type === 'folder') return a.index - b.index // both folders here
      const ia = options.importanceOf?.(a) ?? -1
      const ib = options.importanceOf?.(b as BookmarkNode) ?? -1
      return ib - ia || a.title.localeCompare(b.title) // higher importance first
    }
    case 'manual':
    default:
      return a.index - b.index
  }
}

/** Recursively sort children by the chosen key. Returns new nodes (immutable). */
export function sortTree(
  roots: readonly TreeNode[],
  key: SortKey,
  options: SortOptions = {},
): TreeNode[] {
  const sortNodes = (nodes: readonly TreeNode[]): TreeNode[] =>
    [...nodes]
      .map((node) => (isFolder(node) ? { ...node, children: sortNodes(node.children) } : node))
      .sort((a, b) => compareNodes(a, b, key, options))
  return sortNodes(roots)
}

export interface FlattenOptions {
  /** Treat every folder as expanded (used while a search/filter is active). */
  expandAll?: boolean
}

/**
 * Depth-first flatten of the *visible* nodes for windowed rendering. A folder's
 * children are emitted only when it is expanded (or when `expandAll` is set).
 */
export function flattenVisible(
  roots: readonly TreeNode[],
  expandedIds: ReadonlySet<BookmarkId>,
  options: FlattenOptions = {},
): FlatNode[] {
  const { expandAll = false } = options
  const out: FlatNode[] = []
  const walk = (nodes: readonly TreeNode[], depth: number) => {
    for (const node of nodes) {
      if (isFolder(node)) {
        const hasChildren = node.children.length > 0
        const isExpanded = hasChildren && (expandAll || expandedIds.has(node.id))
        out.push({ node, depth, hasChildren, isExpanded })
        if (isExpanded) walk(node.children, depth + 1)
      } else {
        out.push({ node, depth, hasChildren: false, isExpanded: false })
      }
    }
  }
  walk(roots, 0)
  return out
}
