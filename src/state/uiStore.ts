import { create } from 'zustand'
import { type BookmarkId, type SortKey } from '@/bookmarks/types'

/**
 * Client-side view state for the manager: what the user is searching/filtering
 * for and which folders are open. The bookmark data itself is owned by TanStack
 * Query; this store only holds ephemeral UI intent.
 */
interface UiState {
  searchQuery: string
  /** Selected domain, or '' for "all domains". */
  domainFilter: string
  /** Selected AI category, or '' for "all categories". */
  categoryFilter: string
  /** Selected AI tag, or '' for "all tags". */
  tagFilter: string
  sortKey: SortKey
  expandedIds: Set<BookmarkId>

  setSearchQuery: (query: string) => void
  setDomainFilter: (domain: string) => void
  setCategoryFilter: (category: string) => void
  setTagFilter: (tag: string) => void
  setSortKey: (key: SortKey) => void
  toggleExpanded: (id: BookmarkId) => void
  expandAll: (ids: readonly BookmarkId[]) => void
  collapseAll: () => void
}

export const useUiStore = create<UiState>((set) => ({
  searchQuery: '',
  domainFilter: '',
  categoryFilter: '',
  tagFilter: '',
  sortKey: 'manual',
  expandedIds: new Set(),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDomainFilter: (domainFilter) => set({ domainFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setSortKey: (sortKey) => set({ sortKey }),
  toggleExpanded: (id) =>
    set((state) => {
      const expandedIds = new Set(state.expandedIds)
      if (expandedIds.has(id)) expandedIds.delete(id)
      else expandedIds.add(id)
      return { expandedIds }
    }),
  expandAll: (ids) => set({ expandedIds: new Set(ids) }),
  collapseAll: () => set({ expandedIds: new Set() }),
}))
