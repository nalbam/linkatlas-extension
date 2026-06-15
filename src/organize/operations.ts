import { type StoredAnalysis } from '@/analysis/types'
import { type BookmarkNode } from '@/bookmarks/types'
import { type CategoryGroup, type OrganizeState } from './types'

/**
 * Pure reducers + grouping for category management. Every operation returns a
 * new {@link OrganizeState} (immutable) and is membership-agnostic: the caller
 * passes the affected URLs (computed from the current grouping), which keeps
 * these functions pure and unit-testable.
 */

export const UNCATEGORIZED = 'Uncategorized'
export const EMPTY_ORGANIZE: OrganizeState = { overrides: {}, extraCategories: [] }

type AnalysisMap = Record<string, StoredAnalysis>

/** The category a bookmark belongs to: override → AI category → Uncategorized. */
export function effectiveCategory(
  url: string,
  analysisByUrl: AnalysisMap,
  state: OrganizeState,
): string {
  const override = state.overrides[url]
  if (override) return override
  const analyzed = analysisByUrl[url]
  if (analyzed?.status === 'ok' && analyzed.category) return analyzed.category
  return UNCATEGORIZED
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function compareGroups(a: CategoryGroup, b: CategoryGroup): number {
  if (a.category === UNCATEGORIZED) return 1 // Uncategorized always last.
  if (b.category === UNCATEGORIZED) return -1
  return a.category.localeCompare(b.category)
}

/** Group bookmarks into categories, seeding empty created categories. */
export function groupByCategory(
  bookmarks: readonly BookmarkNode[],
  analysisByUrl: AnalysisMap,
  state: OrganizeState,
): CategoryGroup[] {
  const groups = new Map<string, BookmarkNode[]>()
  for (const name of state.extraCategories) {
    if (!groups.has(name)) groups.set(name, [])
  }
  for (const bookmark of bookmarks) {
    const category = effectiveCategory(bookmark.url, analysisByUrl, state)
    const list = groups.get(category)
    if (list) list.push(bookmark)
    else groups.set(category, [bookmark])
  }
  return [...groups.entries()]
    .map(([category, items]) => ({ category, bookmarks: items }))
    .sort(compareGroups)
}

export function createCategory(state: OrganizeState, name: string): OrganizeState {
  const trimmed = name.trim()
  if (!trimmed || state.extraCategories.includes(trimmed)) return state
  return { ...state, extraCategories: [...state.extraCategories, trimmed] }
}

export function moveBookmarks(
  state: OrganizeState,
  urls: readonly string[],
  to: string,
): OrganizeState {
  const target = to.trim()
  if (!target || urls.length === 0) return state
  const overrides = { ...state.overrides }
  for (const url of urls) overrides[url] = target
  return { ...state, overrides }
}

export function renameCategory(
  state: OrganizeState,
  from: string,
  to: string,
  affectedUrls: readonly string[],
): OrganizeState {
  const target = to.trim()
  if (!target || from === target) return state
  const overrides = { ...state.overrides }
  for (const url of affectedUrls) overrides[url] = target
  const extraCategories = dedupe(state.extraCategories.map((c) => (c === from ? target : c)))
  return { ...state, overrides, extraCategories }
}

export function mergeCategories(
  state: OrganizeState,
  sources: readonly string[],
  target: string,
  affectedUrls: readonly string[],
): OrganizeState {
  const dest = target.trim()
  if (!dest) return state
  const overrides = { ...state.overrides }
  for (const url of affectedUrls) overrides[url] = dest
  const sourceSet = new Set(sources.filter((s) => s !== dest))
  const extraCategories = state.extraCategories.filter((c) => !sourceSet.has(c))
  return { ...state, overrides, extraCategories }
}

export function deleteCategory(
  state: OrganizeState,
  name: string,
  affectedUrls: readonly string[],
  reassignTo: string = UNCATEGORIZED,
): OrganizeState {
  const overrides = { ...state.overrides }
  for (const url of affectedUrls) overrides[url] = reassignTo
  const extraCategories = state.extraCategories.filter((c) => c !== name)
  return { ...state, overrides, extraCategories }
}
