/**
 * Domain model for bookmarks.
 *
 * We mirror the Chrome bookmark tree but normalise it into a discriminated
 * union (`folder` | `bookmark`) and pre-compute the `domain` so the UI and
 * sort/filter utilities never have to re-parse URLs. The original hierarchy and
 * sibling order (`index`) are preserved so we can faithfully apply changes back
 * to Chrome later.
 */

export type BookmarkId = string

interface BaseNode {
  id: BookmarkId
  parentId?: BookmarkId
  title: string
  index: number
  dateAdded?: number
}

export interface BookmarkNode extends BaseNode {
  type: 'bookmark'
  url: string
  domain: string
}

export interface FolderNode extends BaseNode {
  type: 'folder'
  dateGroupModified?: number
  children: TreeNode[]
}

export type TreeNode = FolderNode | BookmarkNode

/** A single row in the virtualized, flattened view of the tree. */
export interface FlatNode {
  node: TreeNode
  depth: number
  /** True when this is a folder that contains at least one child. */
  hasChildren: boolean
  /** True when a folder is currently rendering its children. */
  isExpanded: boolean
}

/** Ordering applied recursively within every folder. */
export type SortKey = 'manual' | 'title' | 'domain' | 'recent'

export function isFolder(node: TreeNode): node is FolderNode {
  return node.type === 'folder'
}

export function isBookmark(node: TreeNode): node is BookmarkNode {
  return node.type === 'bookmark'
}
