import { type PipelineStatus, type PipelineStep, type PipelineView } from '../pipelineStep'
import { Button } from '@/ui/components/Button'

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'collect', label: '① 수집' },
  { key: 'analyze', label: '② 분석' },
  { key: 'organize', label: '③ 정리·적용' },
  { key: 'done', label: '④ 완료' },
]

interface PipelineGuideProps {
  status: PipelineStatus
  viewMode: PipelineView
  /** A job is running — the per-view progress bar speaks for itself, so hide the guide. */
  busy: boolean
  onSwitchView: (view: PipelineView) => void
}

/**
 * A single across-the-top guide that ties the five pipeline stages into one flow:
 * it highlights the current step, says what to do next, and — when that action
 * lives in the other view — offers a one-click switch. Suggestions only; it never
 * runs anything (the privacy/cost gates stay in charge of sending).
 */
export function PipelineGuide({ status, viewMode, busy, onSwitchView }: PipelineGuideProps) {
  if (busy) return null
  const activeIndex = STEPS.findIndex((s) => s.key === status.step)
  const needsSwitch = status.view !== viewMode && status.step !== 'done'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface/40 px-4 py-2 text-sm">
      <div className="flex items-center gap-1">
        {STEPS.map((step, index) => (
          <span
            key={step.key}
            className={`rounded px-1.5 py-0.5 text-xs ${
              index === activeIndex
                ? 'bg-accent/20 font-medium text-accent'
                : index < activeIndex
                  ? 'text-muted'
                  : 'text-muted/50'
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>

      <span className="text-slate-200">{status.nextLabel}</span>

      {needsSwitch && (
        <Button variant="default" onClick={() => onSwitchView(status.view)}>
          {status.view === 'organize' ? 'Organize 열기' : 'Tree 열기'}
        </Button>
      )}

      {status.blockers.map((blocker) => (
        <span key={blocker} className="text-xs text-amber-300">
          ⚠ {blocker}
        </span>
      ))}
    </div>
  )
}
