import { useEffect, useMemo, useState } from 'react'
import { buildAnalyzeInput } from '@/analysis/analyzeInput'
import { hasFreshAnalysis } from '@/analysis/cache'
import { collectBookmarkUrls, collectDomains, collectFolderIds, countTree } from '@/bookmarks/tree'
import { isFolder, type TreeNode } from '@/bookmarks/types'
import { selectFilteredBookmarks, selectVisibleRows, type ViewState } from '@/state/selectors'
import { useAnalysisStore } from '@/state/analysisStore'
import { useApplyStore } from '@/state/applyStore'
import { useMetadataStore } from '@/state/metadataStore'
import { useSettingsStore } from '@/state/settingsStore'
import { useUiStore, type ViewMode } from '@/state/uiStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'
import { AnalysisBar } from './components/AnalysisBar'
import { AnalyzeDialog } from './components/AnalyzeDialog'
import { BookmarkTreeView } from './components/BookmarkTreeView'
import { MetadataBar } from './components/MetadataBar'
import { OrganizeView } from './components/OrganizeView'
import { PipelineGuide } from './components/PipelineGuide'
import { SettingsPanel } from './components/SettingsPanel'
import { TagStatsPanel } from './components/TagStatsPanel'
import { Toolbar } from './components/Toolbar'
import { derivePipelineStep } from './pipelineStep'
import { useBookmarkTree } from './hooks/useBookmarkTree'

const EMPTY_ROOTS: TreeNode[] = []

export function App() {
  const { data, isLoading, isError, error, refetch, isFetching } = useBookmarkTree()
  const roots = data ?? EMPTY_ROOTS

  const searchQuery = useUiStore((s) => s.searchQuery)
  const domainFilter = useUiStore((s) => s.domainFilter)
  const categoryFilter = useUiStore((s) => s.categoryFilter)
  const tagFilter = useUiStore((s) => s.tagFilter)
  const sortKey = useUiStore((s) => s.sortKey)
  const viewMode = useUiStore((s) => s.viewMode)
  const setViewMode = useUiStore((s) => s.setViewMode)
  const expandedIds = useUiStore((s) => s.expandedIds)
  const toggleExpanded = useUiStore((s) => s.toggleExpanded)
  const expandAll = useUiStore((s) => s.expandAll)
  const collapseAll = useUiStore((s) => s.collapseAll)
  const hasHydrated = useUiStore((s) => s.hasHydrated)
  const setTagFilter = useUiStore((s) => s.setTagFilter)

  const metadataByUrl = useMetadataStore((s) => s.byUrl)
  const loadMetadataFromCache = useMetadataStore((s) => s.loadFromCache)
  const attachMetadata = useMetadataStore((s) => s.attach)
  const metadataRunning = useMetadataStore((s) => s.job.running)

  const analysisByUrl = useAnalysisStore((s) => s.byUrl)
  const loadAnalysisFromCache = useAnalysisStore((s) => s.loadFromCache)
  const attachAnalysis = useAnalysisStore((s) => s.attach)
  const analysisRunning = useAnalysisStore((s) => s.job.running)
  const startAnalysis = useAnalysisStore((s) => s.startAnalysis)

  const applyRunning = useApplyStore((s) => s.job.running)
  const hasSnapshot = useApplyStore((s) => s.hasSnapshot)
  const refreshSnapshotFlag = useApplyStore((s) => s.refreshSnapshotFlag)

  const provider = useSettingsStore((s) => s.provider)
  const apiKey = useSettingsStore((s) => s.apiKeys[provider])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [didInit, setDidInit] = useState(false)

  const openUrl = (url: string) => window.open(url, '_blank', 'noopener')

  const view: ViewState = { searchQuery, domainFilter, categoryFilter, tagFilter, sortKey, expandedIds }

  const counts = useMemo(() => countTree(roots), [roots])
  const domains = useMemo(() => collectDomains(roots), [roots])
  const allUrls = useMemo(() => collectBookmarkUrls(roots), [roots])
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const a of Object.values(analysisByUrl)) {
      if (a.status === 'ok' && a.category) set.add(a.category)
    }
    return [...set].sort((x, y) => x.localeCompare(y))
  }, [analysisByUrl])

  const metadataCount = useMemo(
    () => Object.values(metadataByUrl).filter((m) => m.status === 'ok').length,
    [metadataByUrl],
  )
  const categorizedCount = useMemo(
    () => Object.values(analysisByUrl).filter((a) => a.status === 'ok' && a.category).length,
    [analysisByUrl],
  )
  const pipelineStatus = useMemo(
    () =>
      derivePipelineStep({
        totalBookmarks: counts.bookmarks,
        metadataCount,
        categorizedCount,
        hasSnapshot,
      }),
    [counts.bookmarks, metadataCount, categorizedCount, hasSnapshot],
  )
  const anyJobRunning = metadataRunning || analysisRunning || applyRunning
  const rows = useMemo(
    () => selectVisibleRows(roots, view, analysisByUrl),
    [roots, searchQuery, domainFilter, categoryFilter, tagFilter, sortKey, expandedIds, analysisByUrl],
  )
  // Scope for "Analyze": bookmarks matching current filters that lack a fresh
  // analysis (independent of expand state).
  const analyzeItems = useMemo(() => {
    return selectFilteredBookmarks(roots, view, analysisByUrl)
      .filter((b) => !hasFreshAnalysis(analysisByUrl[b.url]))
      .map((b) => ({ url: b.url, input: buildAnalyzeInput(b, metadataByUrl[b.url]) }))
  }, [roots, searchQuery, domainFilter, categoryFilter, tagFilter, analysisByUrl, metadataByUrl])
  const shownBookmarks = useMemo(
    () => rows.reduce((n, row) => (row.node.type === 'bookmark' ? n + 1 : n), 0),
    [rows],
  )
  const analyzeWithoutMeta = useMemo(
    () => analyzeItems.filter((item) => metadataByUrl[item.url]?.status !== 'ok').length,
    [analyzeItems, metadataByUrl],
  )

  // Hydrate cached metadata + analysis once on mount, then re-attach to any job
  // still running in the worker (e.g. after an options-page reload).
  useEffect(() => {
    void loadMetadataFromCache().then(() => attachMetadata())
    void loadAnalysisFromCache().then(() => attachAnalysis())
    void refreshSnapshotFlag()
  }, [loadMetadataFromCache, loadAnalysisFromCache, attachMetadata, attachAnalysis, refreshSnapshotFlag])

  // Open the top-level roots once on first run — but only after the persisted
  // expand state has hydrated, and only if nothing was saved (so a reload keeps
  // the user's own expand/collapse).
  useEffect(() => {
    if (!didInit && hasHydrated && roots.length > 0) {
      if (expandedIds.size === 0) {
        expandAll(roots.filter(isFolder).map((node) => node.id))
      }
      setDidInit(true)
    }
  }, [didInit, hasHydrated, roots, expandedIds, expandAll])

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
        <div className="flex items-center gap-2">
          <ViewToggle view={viewMode} onChange={setViewMode} />
          <Button variant="default" onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" size={16} />
            Settings
          </Button>
        </div>
      </header>

      <PipelineGuide
        status={pipelineStatus}
        viewMode={viewMode}
        busy={anyJobRunning}
        onSwitchView={setViewMode}
      />

      {viewMode === 'tree' ? (
        <>
          <Toolbar
            domains={domains}
            categories={categories}
            onExpandAll={() => expandAll(collectFolderIds(roots))}
            onCollapseAll={collapseAll}
            onRefresh={() => void refetch()}
          />

          <MetadataBar allUrls={allUrls} />

          <AnalysisBar
            pendingCount={analyzeItems.length}
            statsOpen={statsOpen}
            onAnalyze={() => setAnalyzeOpen(true)}
            onToggleStats={() => setStatsOpen((open) => !open)}
          />

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
                analysisByUrl={analysisByUrl}
                onToggle={toggleExpanded}
                onOpen={openUrl}
              />
            )}
          </main>

          <footer className="border-t border-border px-4 py-1.5 text-xs text-muted">
            {shownBookmarks.toLocaleString()} shown
          </footer>
        </>
      ) : (
        <div className="min-h-0 flex-1">
          <OrganizeView
            roots={roots}
            analysisByUrl={analysisByUrl}
            metadataByUrl={metadataByUrl}
            onOpen={openUrl}
          />
        </div>
      )}

      <AnalyzeDialog
        open={analyzeOpen}
        onClose={() => setAnalyzeOpen(false)}
        items={analyzeItems}
        provider={provider}
        hasKey={apiKey.trim().length > 0}
        model=""
        withoutMetadata={analyzeWithoutMeta}
        onConfirm={() => startAnalysis({ provider, apiKey, items: analyzeItems })}
      />

      <TagStatsPanel
        open={statsOpen}
        analysisByUrl={analysisByUrl}
        activeTag={tagFilter}
        onPickTag={(tag) => {
          setTagFilter(tag)
          setStatsOpen(false)
        }}
        onClose={() => setStatsOpen(false)}
      />

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

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div className="flex rounded-md border border-border bg-surface p-0.5">
      <ToggleButton active={view === 'tree'} onClick={() => onChange('tree')} icon="list" label="Tree" />
      <ToggleButton
        active={view === 'organize'}
        onClick={() => onChange('organize')}
        icon="grid"
        label="Organize"
      />
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: 'list' | 'grid'
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-sm transition-colors ${
        active ? 'bg-surface-raised text-slate-100' : 'text-muted hover:text-slate-100'
      }`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  )
}
