import { useMemo } from 'react'
import { type StoredAnalysis } from '@/analysis/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

interface FailureLogViewProps {
  metadataByUrl: Record<string, BookmarkMetadata>
  analysisByUrl: Record<string, StoredAnalysis>
  onOpen: (url: string) => void
}

interface FailureItem {
  key: string
  kind: 'Metadata' | 'Analyze'
  url: string
  message: string
  timestamp: number
}

export function FailureLogView({ metadataByUrl, analysisByUrl, onOpen }: FailureLogViewProps) {
  const failures = useMemo(() => {
    const items: FailureItem[] = []
    for (const meta of Object.values(metadataByUrl)) {
      if (meta.status !== 'ok') {
        items.push({
          key: `metadata:${meta.url}`,
          kind: 'Metadata',
          url: meta.url,
          message: meta.error ?? meta.status,
          timestamp: meta.fetchedAt,
        })
      }
    }
    for (const analysis of Object.values(analysisByUrl)) {
      if (analysis.status === 'error') {
        items.push({
          key: `analysis:${analysis.url}`,
          kind: 'Analyze',
          url: analysis.url,
          message: analysis.error ?? 'Analysis failed',
          timestamp: analysis.analyzedAt,
        })
      }
    }
    return items.sort((a, b) => b.timestamp - a.timestamp)
  }, [metadataByUrl, analysisByUrl])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">Failed records</h2>
        <p className="mt-1 text-xs text-muted">
          {failures.length.toLocaleString()} failed metadata or analyze records in cache
        </p>
      </div>
      {failures.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
          No failed records found.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-28 px-4 py-2 font-medium">Step</th>
                <th className="px-4 py-2 font-medium">URL</th>
                <th className="w-[34%] px-4 py-2 font-medium">Reason</th>
                <th className="w-44 px-4 py-2 font-medium">Time</th>
                <th className="w-24 px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {failures.map((failure) => (
                <tr key={failure.key} className="border-b border-border/70 hover:bg-surface-raised/50">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5 rounded bg-rose-950/50 px-2 py-0.5 text-xs font-medium text-rose-200">
                      <Icon name="alert" size={14} />
                      {failure.kind}
                    </span>
                  </td>
                  <td className="truncate px-4 py-2 text-slate-200" title={failure.url}>
                    {failure.url}
                  </td>
                  <td className="truncate px-4 py-2 text-rose-200" title={failure.message}>
                    {failure.message}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{formatTime(failure.timestamp)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onOpen(failure.url)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatTime(timestamp: number) {
  if (!timestamp) return '-'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
