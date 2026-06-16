import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type BookmarkId, type SortKey } from '@/bookmarks/types'
import { chromeStorageAdapter } from '@/utils/chromeStorage'

/**
 * Client-side view state for the manager: what the user is searching/filtering
 * for and which folders are open. The bookmark data itself is owned by TanStack
 * Query; this store only holds view intent. Expand/collapse state (the tree's
 * `expandedIds` and the organize tree's `organizeCollapsed`) is persisted to
 * `chrome.storage.local` so it survives a reload; search/filter/sort stay
 * ephemeral.
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
  /** Expanded folder ids in the Tree view. */
  expandedIds: Set<BookmarkId>
  /** Collapsed node keys in the Organize view (default is expanded). */
  organizeCollapsed: Set<string>
  hasHydrated: boolean

  setSearchQuery: (query: string) => void
  setDomainFilter: (domain: string) => void
  setCategoryFilter: (category: string) => void
  setTagFilter: (tag: string) => void
  setSortKey: (key: SortKey) => void
  toggleExpanded: (id: BookmarkId) => void
  expandAll: (ids: readonly BookmarkId[]) => void
  collapseAll: () => void
  toggleOrganizeCollapsed: (key: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      searchQuery: '',
      domainFilter: '',
      categoryFilter: '',
      tagFilter: '',
      sortKey: 'manual',
      expandedIds: new Set(),
      organizeCollapsed: new Set(),
      hasHydrated: false,

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
      toggleOrganizeCollapsed: (key) =>
        set((state) => {
          const organizeCollapsed = new Set(state.organizeCollapsed)
          if (organizeCollapsed.has(key)) organizeCollapsed.delete(key)
          else organizeCollapsed.add(key)
          return { organizeCollapsed }
        }),
    }),
    {
      name: 'linkatlas-ui',
      storage: createJSONStorage(() => chromeStorageAdapter),
      // Only persist expand/collapse; Sets serialize as arrays and rehydrate back.
      partialize: (state) => ({
        expandedIds: Array.from(state.expandedIds),
        organizeCollapsed: Array.from(state.organizeCollapsed),
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as {
          expandedIds?: BookmarkId[]
          organizeCollapsed?: string[]
        }
        return {
          ...current,
          expandedIds: new Set(saved.expandedIds ?? []),
          organizeCollapsed: new Set(saved.organizeCollapsed ?? []),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
