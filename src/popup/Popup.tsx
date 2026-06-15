import { useEffect, useState } from 'react'
import { countTree, type TreeCounts } from '@/bookmarks/tree'
import { loadBookmarkTree } from '@/services/bookmarkService'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

export function Popup() {
  const [counts, setCounts] = useState<TreeCounts | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadBookmarkTree()
      .then((roots) => setCounts(countTree(roots)))
      .catch(() => setFailed(true))
  }, [])

  const openManager = () => {
    chrome.runtime.openOptionsPage()
    window.close()
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <Icon name="globe" size={18} />
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight text-slate-100">LinkAtlas</h1>
          <p className="text-xs text-muted">AI bookmark organizer</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat label="Bookmarks" value={failed ? '—' : counts?.bookmarks} />
        <Stat label="Folders" value={failed ? '—' : counts?.folders} />
      </div>

      <Button variant="primary" className="w-full justify-center" onClick={openManager}>
        Open Manager
      </Button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-md border border-border bg-surface-raised px-3 py-2">
      <div className="text-lg font-semibold text-slate-100">
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '…')}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
