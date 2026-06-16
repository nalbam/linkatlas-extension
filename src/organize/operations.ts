import { type StoredAnalysis } from '@/analysis/types'
import { type BookmarkNode } from '@/bookmarks/types'
import {
  type Path,
  type PathOrigin,
  UNCATEGORIZED,
  effectivePath,
  hasPrefix,
  pathKey,
  rebasePrefix,
} from './path'
import { type OrganizeState, type PathTreeNode, type RootTreeNode } from './types'

/**
 * Pure grouping + reducers for the path-based organize working plan. Every
 * operation returns a new {@link OrganizeState} (immutable). Reducers are
 * membership-agnostic: the caller passes the affected {@link Placement}s
 * (computed from the current grouping), so these functions stay pure and
 * unit-testable.
 */

export { UNCATEGORIZED }

export const EMPTY_ORGANIZE: OrganizeState = {
  version: 3,
  overrides: {},
  rootOverrides: {},
  extraPaths: [],
  purposeRoots: [],
}

/** An explicit url → path assignment used by the path-rewriting reducers. */
export interface Placement {
  url: string
  path: Path
}

type AnalysisMap = Record<string, StoredAnalysis>

function cleanPath(path: Path): Path {
  return path.map((segment) => segment.trim()).filter(Boolean)
}

function dedupePaths(paths: readonly Path[]): Path[] {
  const seen = new Set<string>()
  const out: Path[] = []
  for (const path of paths) {
    const key = pathKey(path)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(path)
  }
  return out
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

interface BuildNode {
  segment: string
  path: Path
  origin: PathOrigin
  bookmarks: BookmarkNode[]
  children: Map<string, BuildNode>
}

function compareTreeNodes(a: PathTreeNode, b: PathTreeNode): number {
  if (a.segment === UNCATEGORIZED) return 1 // Uncategorized always last.
  if (b.segment === UNCATEGORIZED) return -1
  if (a.origin !== b.origin) return a.origin === 'purpose' ? -1 : 1 // purpose groups first.
  return a.segment.localeCompare(b.segment)
}

/**
 * Build the nested organization tree from every bookmark's effective path.
 * Empty `extraPaths` are seeded so user-created folders still render. A node's
 * origin is `purpose` if any contributor is a purpose path.
 */
export function buildPathTree(
  bookmarks: readonly BookmarkNode[],
  originalPathByUrl: Record<string, Path>,
  analysisByUrl: AnalysisMap,
  state: OrganizeState,
): PathTreeNode[] {
  const roots = new Map<string, BuildNode>()

  const descend = (path: Path, origin: PathOrigin): BuildNode => {
    let level = roots
    let node!: BuildNode
    const acc: string[] = []
    for (const segment of path) {
      acc.push(segment)
      const existing = level.get(segment)
      if (existing) {
        node = existing
        if (origin === 'purpose') node.origin = 'purpose'
      } else {
        node = { segment, path: [...acc], origin, bookmarks: [], children: new Map() }
        level.set(segment, node)
      }
      level = node.children
    }
    return node
  }

  for (const raw of state.extraPaths) {
    const path = cleanPath(raw)
    if (!path.length) continue
    descend(path, state.purposeRoots.includes(path[0]) ? 'purpose' : 'category')
  }

  for (const bookmark of bookmarks) {
    const { path, origin } = effectivePath(bookmark, originalPathByUrl, analysisByUrl, state)
    if (!path.length) continue
    descend(path, origin).bookmarks.push(bookmark)
  }

  const freeze = (level: Map<string, BuildNode>): PathTreeNode[] =>
    [...level.values()]
      .map((node) => ({
        segment: node.segment,
        path: node.path,
        origin: node.origin,
        bookmarks: node.bookmarks,
        children: freeze(node.children),
      }))
      .sort(compareTreeNodes)

  return freeze(roots)
}

export interface RootInfo {
  rootId: string
  title: string
}

/**
 * Group bookmarks by their effective 大 root (rootOverride → original root),
 * then build the existing 中/小 tree within each. The 大 list `rootsInfo` comes
 * from the live Chrome roots, so empty 大 still render in their natural order.
 * Empty `extraPaths` (user-created folders) render under the first root (bar) only.
 */
export function buildRootTree(
  bookmarks: readonly BookmarkNode[],
  rootsInfo: readonly RootInfo[],
  originalPathByUrl: Record<string, Path>,
  originalRootByUrl: Record<string, string>,
  analysisByUrl: AnalysisMap,
  state: OrganizeState,
): RootTreeNode[] {
  const titleToId = new Map(rootsInfo.map((root) => [root.title, root.rootId]))
  const buckets = new Map<string, BookmarkNode[]>()
  for (const bookmark of bookmarks) {
    const title = state.rootOverrides[bookmark.url] ?? originalRootByUrl[bookmark.url] ?? ''
    const rootId = titleToId.get(title) ?? rootsInfo[0]?.rootId ?? ''
    const list = buckets.get(rootId)
    if (list) list.push(bookmark)
    else buckets.set(rootId, [bookmark])
  }
  return rootsInfo.map(({ rootId, title }, index) => {
    const slice = buckets.get(rootId) ?? []
    const childState = index === 0 ? state : { ...state, extraPaths: [] }
    const children = buildPathTree(slice, originalPathByUrl, analysisByUrl, childState)
    return { rootId, title, children, bookmarkCount: slice.length }
  })
}

// ---------------------------------------------------------------------------
// Reducers (all pure, membership-agnostic)
// ---------------------------------------------------------------------------

function withPlacements(state: OrganizeState, placements: readonly Placement[]): OrganizeState {
  if (placements.length === 0) return state
  const overrides = { ...state.overrides }
  let changed = false
  for (const { url, path } of placements) {
    const clean = cleanPath(path)
    if (!clean.length) continue
    overrides[url] = clean
    changed = true
  }
  return changed ? { ...state, overrides } : state
}

/** Create an (initially empty) path so a new folder renders. */
export function createPath(state: OrganizeState, path: Path): OrganizeState {
  const clean = cleanPath(path)
  if (!clean.length) return state
  if (state.extraPaths.some((p) => pathKey(p) === pathKey(clean))) return state
  return { ...state, extraPaths: [...state.extraPaths, clean] }
}

/** Move bookmarks to a single target path (manual override). */
export function moveBookmarks(
  state: OrganizeState,
  urls: readonly string[],
  to: Path,
): OrganizeState {
  const target = cleanPath(to)
  if (!target.length || urls.length === 0) return state
  return withPlacements(state, urls.map((url) => ({ url, path: target })))
}

/**
 * Rename a path node (and its subtree): the caller passes `affected` — the new
 * placement of every bookmark under `from` (rebased to `to`). `extraPaths` are
 * prefix-rebased here.
 */
export function renamePath(
  state: OrganizeState,
  from: Path,
  to: Path,
  affected: readonly Placement[],
): OrganizeState {
  const source = cleanPath(from)
  const target = cleanPath(to)
  if (!source.length || !target.length || pathKey(source) === pathKey(target)) return state
  const moved = withPlacements(state, affected)
  const extraPaths = dedupePaths(moved.extraPaths.map((p) => rebasePrefix(p, source, target)))
  return { ...moved, extraPaths }
}

/** Merge source paths into a target path. `affected` carries the rebased members. */
export function mergePaths(
  state: OrganizeState,
  sources: readonly Path[],
  target: Path,
  affected: readonly Placement[],
): OrganizeState {
  const dest = cleanPath(target)
  if (!dest.length) return state
  const moved = withPlacements(state, affected)
  const cleanSources = sources
    .map(cleanPath)
    .filter((p) => p.length && pathKey(p) !== pathKey(dest))
  const extraPaths = dedupePaths(
    moved.extraPaths.map((p) => {
      const src = cleanSources.find((s) => hasPrefix(p, s))
      return src ? rebasePrefix(p, src, dest) : p
    }),
  )
  return { ...moved, extraPaths }
}

/** Delete a path; `affected` reassigns its members (e.g. to Uncategorized). */
export function deletePath(
  state: OrganizeState,
  path: Path,
  affected: readonly Placement[],
): OrganizeState {
  const target = cleanPath(path)
  if (!target.length) return state
  const moved = withPlacements(state, affected)
  const extraPaths = moved.extraPaths.filter((p) => !hasPrefix(p, target))
  return { ...moved, extraPaths }
}

/** Toggle whether a top-level segment is treated as a purpose group. */
export function togglePurposeRoot(state: OrganizeState, segment: string): OrganizeState {
  const seg = segment.trim()
  if (!seg) return state
  const has = state.purposeRoots.includes(seg)
  return {
    ...state,
    purposeRoots: has
      ? state.purposeRoots.filter((s) => s !== seg)
      : [...state.purposeRoots, seg],
  }
}

// ---------------------------------------------------------------------------
// 大 (browser root) moves — set rootOverride + override together.
// ---------------------------------------------------------------------------

/** A placement that also carries the destination 大 root title. */
export interface RootPlacement extends Placement {
  rootTitle: string
}

function withRootPlacements(
  state: OrganizeState,
  placements: readonly RootPlacement[],
): OrganizeState {
  if (placements.length === 0) return state
  const overrides = { ...state.overrides }
  const rootOverrides = { ...state.rootOverrides }
  let changed = false
  for (const { url, path, rootTitle } of placements) {
    const clean = cleanPath(path)
    if (!clean.length || !rootTitle) continue
    overrides[url] = clean
    rootOverrides[url] = rootTitle
    changed = true
  }
  return changed ? { ...state, overrides, rootOverrides } : state
}

/** Move bookmarks to a single 大 root + path. */
export function moveBookmarksToRoot(
  state: OrganizeState,
  urls: readonly string[],
  toRootTitle: string,
  toPath: Path,
): OrganizeState {
  const path = cleanPath(toPath)
  if (!path.length || !toRootTitle || urls.length === 0) return state
  return withRootPlacements(
    state,
    urls.map((url) => ({ url, path, rootTitle: toRootTitle })),
  )
}

/** Move a whole subtree to a new 大 root + path; `affected` carries each rebased placement. */
export function moveSubtreeToRoot(
  state: OrganizeState,
  from: Path,
  toRootTitle: string,
  toPath: Path,
  affected: readonly RootPlacement[],
): OrganizeState {
  const source = cleanPath(from)
  const target = cleanPath(toPath)
  if (!source.length || !target.length || !toRootTitle) return state
  const moved = withRootPlacements(state, affected)
  const extraPaths = dedupePaths(moved.extraPaths.map((p) => rebasePrefix(p, source, target)))
  return { ...moved, extraPaths }
}
