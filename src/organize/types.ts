import { type BookmarkNode } from '@/bookmarks/types'
import { type Path, type PathOrigin } from './path'

/**
 * The editable organization layered over the original tree + AI categories.
 * This is a working plan — Chrome is untouched until apply.
 *
 * - `overrides`: url → explicit path (manual moves; win over original + AI).
 * - `extraPaths`: user-created paths that may have no members yet (so empty
 *   folders still render).
 * - `purposeRoots`: top segments treated as PURPOSE groups — their original
 *   folder structure is preserved and AI category is ignored. Seeded from the
 *   bookmark bar's top-level folders, then user-adjustable.
 */
export interface OrganizeState {
  version: 3
  overrides: Record<string, Path>
  /** url → 大 root title (absent ⇒ the bookmark's original root). */
  rootOverrides: Record<string, string>
  extraPaths: Path[]
  purposeRoots: string[]
}

/** A node in the nested organization tree produced by `buildPathTree`. */
export interface PathTreeNode {
  segment: string
  path: Path
  origin: PathOrigin
  bookmarks: BookmarkNode[]
  children: PathTreeNode[]
}

/**
 * A 大 (browser root: Bookmarks Bar / Other Bookmarks / Mobile) node wrapping a
 * 中/小 `PathTreeNode` forest. Rendered read-only — the root itself is fixed by
 * the browser; only its contents move.
 */
export interface RootTreeNode {
  rootId: string
  title: string
  children: PathTreeNode[]
  bookmarkCount: number
}
