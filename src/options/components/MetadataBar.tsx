import { useMemo, useState, type ReactNode } from 'react'
import { isFresh } from '@/metadata/cache'
import { useMetadataStore } from '@/state/metadataStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

interface MetadataBarProps {
  allUrls: string[]
}

/**
 * Privacy-gated metadata collection control. Clicking requests `<all_urls>` host
 * access on demand (the browser's own consent prompt), then collects metadata
 * only for bookmarks lacking a fresh cached record — making re-runs incremental.
 */
export function MetadataBar({ allUrls }: MetadataBarProps) {
  const byUrl = useMetadataStore((s) => s.byUrl)
  const job = useMetadataStore((s) => s.job)
  const startCollection = useMetadataStore((s) => s.startCollection)
  const cancel = useMetadataStore((s) => s.cancel)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const toFetch = useMemo(() => {
    const now = Date.now()
    return allUrls.filter((url) => !isFresh(byUrl[url], now))
  }, [allUrls, byUrl])

  const handleCollect = async () => {
    setPermissionDenied(false)
    const granted = await chrome.permissions.request({ origins: ['<all_urls>'] })
    if (!granted) {
      setPermissionDenied(true)
      return
    }
    startCollection(toFetch)
  }

  if (job.running) {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0
    return (
      <Bar>
        <div className="flex flex-1 items-center gap-3">
          <span className="shrink-0 text-sm text-slate-200">
            Collecting metadata… {job.done}/{job.total}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Button variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </Bar>
    )
  }

  return (
    <Bar>
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="default" onClick={handleCollect} disabled={toFetch.length === 0}>
          <Icon name="refresh" size={16} />
          {toFetch.length > 0 ? `Collect metadata · ${toFetch.length}` : 'Metadata up to date'}
        </Button>
        <span className="truncate text-xs text-muted">
          Fetches each page once to read its title, description &amp; icon.
        </span>
      </div>
      {permissionDenied ? (
        <span className="shrink-0 text-xs text-rose-300">Host permission is needed to fetch pages.</span>
      ) : job.total > 0 ? (
        <span className="shrink-0 text-xs text-muted">
          Last run: {job.ok} ok · {job.failed} failed
        </span>
      ) : null}
    </Bar>
  )
}

function Bar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-2">
      {children}
    </div>
  )
}
