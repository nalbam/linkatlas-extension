import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { migrateOrganize } from '@/organize/migrate'
import * as ops from '@/organize/operations'
import { type Path } from '@/organize/path'
import { type OrganizeState } from '@/organize/types'
import { chromeStorageAdapter } from '@/utils/chromeStorage'

const HISTORY_LIMIT = 50

/**
 * The path-based organize working state plus an in-session undo history. Only
 * the current `organize` state is persisted (history is ephemeral). Actions
 * delegate to the pure reducers in `organize/operations`; callers pass the
 * affected placements (computed from the rendered grouping) so the reducers stay
 * pure. `seedPurposeRoots` runs once after migration to auto-detect purpose
 * groups from the bookmark bar.
 */
interface OrganizeStore {
  organize: OrganizeState
  history: OrganizeState[]
  hasHydrated: boolean

  createPath: (path: Path) => void
  moveBookmarks: (urls: string[], to: Path) => void
  moveBookmarksToRoot: (urls: string[], toRootTitle: string, toPath: Path) => void
  moveSubtreeToRoot: (from: Path, toRootTitle: string, toPath: Path, affected: ops.RootPlacement[]) => void
  renamePath: (from: Path, to: Path, affected: ops.Placement[]) => void
  mergePaths: (sources: Path[], to: Path, affected: ops.Placement[]) => void
  deletePath: (path: Path, affected: ops.Placement[]) => void
  togglePurposeRoot: (segment: string) => void
  seedPurposeRoots: (segments: string[]) => void
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

        createPath: (path) => apply((s) => ops.createPath(s, path)),
        moveBookmarks: (urls, to) => apply((s) => ops.moveBookmarks(s, urls, to)),
        moveBookmarksToRoot: (urls, toRootTitle, toPath) =>
          apply((s) => ops.moveBookmarksToRoot(s, urls, toRootTitle, toPath)),
        moveSubtreeToRoot: (from, toRootTitle, toPath, affected) =>
          apply((s) => ops.moveSubtreeToRoot(s, from, toRootTitle, toPath, affected)),
        renamePath: (from, to, affected) => apply((s) => ops.renamePath(s, from, to, affected)),
        mergePaths: (sources, to, affected) => apply((s) => ops.mergePaths(s, sources, to, affected)),
        deletePath: (path, affected) => apply((s) => ops.deletePath(s, path, affected)),
        togglePurposeRoot: (segment) => apply((s) => ops.togglePurposeRoot(s, segment)),

        // Seeds purpose roots once (when none are set yet) — not an undoable edit.
        seedPurposeRoots: (segments) =>
          set((store) => {
            if (store.organize.purposeRoots.length > 0 || segments.length === 0) return {}
            return { organize: { ...store.organize, purposeRoots: [...segments] } }
          }),

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
      version: 3,
      storage: createJSONStorage(() => chromeStorageAdapter),
      migrate: (persisted) => {
        const prev = persisted as { organize?: unknown } | undefined
        return { organize: migrateOrganize(prev?.organize) } as Partial<OrganizeStore>
      },
      partialize: ({ organize }) => ({ organize }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
