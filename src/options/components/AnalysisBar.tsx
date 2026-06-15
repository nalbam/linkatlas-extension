import { useAnalysisStore } from '@/state/analysisStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

interface AnalysisBarProps {
  pendingCount: number
  statsOpen: boolean
  onAnalyze: () => void
  onToggleStats: () => void
}

export function AnalysisBar({ pendingCount, statsOpen, onAnalyze, onToggleStats }: AnalysisBarProps) {
  const job = useAnalysisStore((s) => s.job)
  const cancel = useAnalysisStore((s) => s.cancel)

  if (job.running) {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0
    return (
      <Bar>
        <div className="flex flex-1 items-center gap-3">
          <span className="shrink-0 text-sm text-slate-200">
            Analyzing… {job.done}/{job.total}
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
        <Button variant="default" onClick={onAnalyze} disabled={pendingCount === 0}>
          <Icon name="sparkle" size={16} />
          {pendingCount > 0 ? `Analyze · ${pendingCount}` : 'All analyzed'}
        </Button>
        <Button variant="ghost" onClick={onToggleStats}>
          <Icon name="tag" size={16} />
          {statsOpen ? 'Hide tags' : 'Tag stats'}
        </Button>
      </div>
      {job.total > 0 && (
        <span className="shrink-0 text-xs text-muted">
          Last run: {job.ok} ok · {job.failed} failed
        </span>
      )}
    </Bar>
  )
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-4 py-2">
      {children}
    </div>
  )
}
