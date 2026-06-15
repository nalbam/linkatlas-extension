import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import * as ops from '@/organize/operations'
import { type OrganizeState } from '@/organize/types'
import { chromeStorageAdapter } from '@/utils/chromeStorage'

const HISTORY_LIMIT = 50

/**
 * The category-management working state plus an in-session undo history. Only
 * the current `organize` state is persisted (history is ephemeral). Actions
 * delegate to the pure reducers in `organize/operations`; callers pass the
 * affected URLs (computed from the rendered grouping) so the reducers stay pure.
 */
interface OrganizeStore {
  organize: OrganizeState
  history: OrganizeState[]
  hasHydrated: boolean

  createCategory: (name: string) => void
  moveBookmarks: (urls: string[], to: string) => void
  renameCategory: (from: string, to: string, urls: string[]) => void
  mergeCategories: (sources: string[], to: string, urls: string[]) => void
  deleteCategory: (name: string, urls: string[], reassignTo?: string) => void
  undo: () => void
  reset: () => void
}

export const useOrganizeStore = create<OrganizeStore>()(
  persist(
    (set) => {
      const apply = (producer: (state: OrganizeState) => OrganizeState) =>
        set((store) => {
          const next = producer(store.organize)
          if (next === store.organize) return {} // no-op, don't pollute history
          const history = [...store.history, store.organize].slice(-HISTORY_LIMIT)
          return { organize: next, history }
        })

      return {
        organize: ops.EMPTY_ORGANIZE,
        history: [],
        hasHydrated: false,

        createCategory: (name) => apply((s) => ops.createCategory(s, name)),
        moveBookmarks: (urls, to) => apply((s) => ops.moveBookmarks(s, urls, to)),
        renameCategory: (from, to, urls) => apply((s) => ops.renameCategory(s, from, to, urls)),
        mergeCategories: (sources, to, urls) =>
          apply((s) => ops.mergeCategories(s, sources, to, urls)),
        deleteCategory: (name, urls, reassignTo) =>
          apply((s) => ops.deleteCategory(s, name, urls, reassignTo)),

        undo: () =>
          set((store) => {
            if (store.history.length === 0) return {}
            const organize = store.history[store.history.length - 1]
            return { organize, history: store.history.slice(0, -1) }
          }),
        reset: () => apply(() => ops.EMPTY_ORGANIZE),
      }
    },
    {
      name: 'linkatlas-organize',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: ({ organize }) => ({ organize }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
