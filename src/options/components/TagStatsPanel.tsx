import { useMemo } from 'react'
import { type StoredAnalysis } from '@/analysis/types'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

interface TagStatsPanelProps {
  open: boolean
  analysisByUrl: Record<string, StoredAnalysis>
  activeTag: string
  onPickTag: (tag: string) => void
  onClose: () => void
}

/** Right drawer showing tag frequencies across analyzed bookmarks. */
export function TagStatsPanel({
  open,
  analysisByUrl,
  activeTag,
  onPickTag,
  onClose,
}: TagStatsPanelProps) {
  const stats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const analysis of Object.values(analysisByUrl)) {
      if (analysis.status !== 'ok') continue
      for (const tag of analysis.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [analysisByUrl])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[320px] flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">
            Tags <span className="text-muted">({stats.length})</span>
          </h2>
          <Button variant="ghost" onClick={onClose} title="Close">
            <Icon name="close" size={18} />
          </Button>
        </header>

        <div className="flex-1 overflow-auto px-3 py-3">
          {stats.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              No tags yet. Run an analysis to generate tags.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {stats.map(([tag, count]) => {
                const active = tag === activeTag
                return (
                  <li key={tag}>
                    <button
                      type="button"
                      onClick={() => onPickTag(active ? '' : tag)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm ${
                        active
                          ? 'bg-accent/15 text-slate-100'
                          : 'text-slate-200 hover:bg-surface-raised'
                      }`}
                    >
                      <span className="truncate">{tag}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted">{count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
