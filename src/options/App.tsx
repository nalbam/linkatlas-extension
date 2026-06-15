import { useEffect, useMemo, useState } from 'react'
import { collectBookmarkUrls, collectDomains, collectFolderIds, countTree } from '@/bookmarks/tree'
import { isFolder, type TreeNode } from '@/bookmarks/types'
import { selectVisibleRows } from '@/state/selectors'
import { useMetadataStore } from '@/state/metadataStore'
import { useUiStore } from '@/state/uiStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'
import { BookmarkTreeView } from './components/BookmarkTreeView'
import { MetadataBar } from './components/MetadataBar'
import { SettingsPanel } from './components/SettingsPanel'
import { Toolbar } from './components/Toolbar'
import { useBookmarkTree } from './hooks/useBookmarkTree'

const EMPTY_ROOTS: TreeNode[] = []

export function App() {
  const { data, isLoading, isError, error, refetch, isFetching } = useBookmarkTree()
  const roots = data ?? EMPTY_ROOTS

  const searchQuery = useUiStore((s) => s.searchQuery)
  const domainFilter = useUiStore((s) => s.domainFilter)
  const sortKey = useUiStore((s) => s.sortKey)
  const expandedIds = useUiStore((s) => s.expandedIds)
  const toggleExpanded = useUiStore((s) => s.toggleExpanded)
  const expandAll = useUiStore((s) => s.expandAll)
  const collapseAll = useUiStore((s) => s.collapseAll)

  const metadataByUrl = useMetadataStore((s) => s.byUrl)
  const loadMetadataFromCache = useMetadataStore((s) => s.loadFromCache)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [didInit, setDidInit] = useState(false)

  const counts = useMemo(() => countTree(roots), [roots])
  const domains = useMemo(() => collectDomains(roots), [roots])
  const allUrls = useMemo(() => collectBookmarkUrls(roots), [roots])
  const rows = useMemo(
    () => selectVisibleRows(roots, { searchQuery, domainFilter, sortKey, expandedIds }),
    [roots, searchQuery, domainFilter, sortKey, expandedIds],
  )
  const shownBookmarks = useMemo(
    () => rows.reduce((n, row) => (row.node.type === 'bookmark' ? n + 1 : n), 0),
    [rows],
  )

  // Hydrate any previously cached metadata once on mount.
  useEffect(() => {
    void loadMetadataFromCache()
  }, [loadMetadataFromCache])

  // Open the top-level roots once so the user sees structure immediately.
  useEffect(() => {
    if (!didInit && roots.length > 0) {
      expandAll(roots.filter(isFolder).map((node) => node.id))
      setDidInit(true)
    }
  }, [didInit, roots, expandAll])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <Icon name="globe" size={18} />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-slate-100">LinkAtlas</h1>
            <p className="text-xs text-muted">
              {counts.bookmarks.toLocaleString()} bookmarks · {counts.folders.toLocaleString()} folders
              {isFetching && <span className="ml-1 text-accent">· syncing…</span>}
            </p>
          </div>
        </div>
        <Button variant="default" onClick={() => setSettingsOpen(true)}>
          <Icon name="settings" size={16} />
          Settings
        </Button>
      </header>

      <Toolbar
        domains={domains}
        onExpandAll={() => expandAll(collectFolderIds(roots))}
        onCollapseAll={collapseAll}
        onRefresh={() => void refetch()}
      />

      <MetadataBar allUrls={allUrls} />

      <main className="relative flex-1 overflow-hidden">
        {isLoading ? (
          <CenteredMessage>Loading bookmarks…</CenteredMessage>
        ) : isError ? (
          <CenteredMessage>
            <p className="text-rose-300">Failed to read bookmarks.</p>
            <p className="mt-1 text-xs text-muted">{(error as Error)?.message}</p>
            <Button className="mt-3" onClick={() => void refetch()}>
              <Icon name="refresh" size={16} />
              Retry
            </Button>
          </CenteredMessage>
        ) : rows.length === 0 ? (
          <CenteredMessage>
            {counts.bookmarks === 0 ? 'No bookmarks found.' : 'No bookmarks match your filters.'}
          </CenteredMessage>
        ) : (
          <BookmarkTreeView
            rows={rows}
            metadataByUrl={metadataByUrl}
            onToggle={toggleExpanded}
            onOpen={(url) => window.open(url, '_blank', 'noopener')}
          />
        )}
      </main>

      <footer className="border-t border-border px-4 py-1.5 text-xs text-muted">
        {shownBookmarks.toLocaleString()} shown
      </footer>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-muted">
      {children}
    </div>
  )
}
