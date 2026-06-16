import { useMemo, useState } from 'react'
import { estimateUsage } from '@/analysis/estimate'
import { type AnalyzeItem } from '@/analysis/types'
import { PROVIDER_LABELS, type ProviderId } from '@/ai/types'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

/** Provider API origins that need host permission for direct calls. */
const PROVIDER_ORIGINS: Partial<Record<ProviderId, string>> = {
  openai: 'https://api.openai.com/*',
}

interface AnalyzeDialogProps {
  open: boolean
  onClose: () => void
  items: AnalyzeItem[]
  provider: ProviderId
  hasKey: boolean
  model: string
  /** How many of `items` lack collected metadata (analyzed on title/URL only). */
  withoutMetadata: number
  /** Called after host permission is granted; the parent starts the job. */
  onConfirm: () => void
}

function formatUsd(value: number): string {
  if (value === 0) return '$0'
  if (value < 0.01) return `~$${value.toFixed(4)}`
  return `~$${value.toFixed(2)}`
}

/**
 * The privacy + cost gate. Nothing is sent until the user reviews the scope,
 * token/cost estimate, and provider, then confirms — which also triggers the
 * on-demand host-permission request for the provider's API.
 */
export function AnalyzeDialog({
  open,
  onClose,
  items,
  provider,
  hasKey,
  model,
  withoutMetadata,
  onConfirm,
}: AnalyzeDialogProps) {
  const [permissionDenied, setPermissionDenied] = useState(false)
  const estimate = useMemo(() => estimateUsage(items.map((item) => item.input)), [items])

  if (!open) return null

  const supported = provider === 'openai'
  const origin = PROVIDER_ORIGINS[provider]
  const canSend = supported && hasKey && items.length > 0

  const handleConfirm = async () => {
    setPermissionDenied(false)
    if (origin) {
      const granted = await chrome.permissions.request({ origins: [origin] })
      if (!granted) {
        setPermissionDenied(true)
        return
      }
    }
    onConfirm()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <Icon name="sparkle" size={18} />
              Analyze bookmarks
            </h2>
            <Button variant="ghost" onClick={onClose} title="Close">
              <Icon name="close" size={18} />
            </Button>
          </header>

          <div className="space-y-3 px-5 py-5 text-sm">
            <Row label="Bookmarks" value={estimate.bookmarks.toLocaleString()} />
            <Row label="Provider" value={`${PROVIDER_LABELS[provider]}${model ? ` · ${model}` : ''}`} />
            <Row
              label="Est. tokens"
              value={`${estimate.inputTokens.toLocaleString()} in · ${estimate.outputTokens.toLocaleString()} out`}
            />
            <Row label="Est. cost" value={`${formatUsd(estimate.approxUsd)} (approx)`} />

            <p className="rounded-md border border-border bg-surface-raised px-3 py-2 text-xs leading-relaxed text-muted">
              This sends each bookmark's title, URL and collected metadata to{' '}
              {PROVIDER_LABELS[provider]}. Nothing is sent until you confirm. The cost is an
              estimate — actual usage depends on page content and your plan.
            </p>

            {withoutMetadata > 0 && (
              <p className="text-xs text-amber-300">
                {withoutMetadata.toLocaleString()}개는 메타데이터가 없어 제목/URL만으로 분석됩니다 —
                먼저 "Collect metadata"를 실행하면 정확도가 올라갑니다.
              </p>
            )}
            {!supported && (
              <p className="text-xs text-amber-300">
                Only OpenAI is wired up so far. Switch the provider in Settings.
              </p>
            )}
            {supported && !hasKey && (
              <p className="text-xs text-amber-300">
                Add your {PROVIDER_LABELS[provider]} API key in Settings first.
              </p>
            )}
            {permissionDenied && (
              <p className="text-xs text-rose-300">
                Host permission for {PROVIDER_LABELS[provider]} is needed to send the request.
              </p>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!canSend}>
              <Icon name="sparkle" size={16} />
              Analyze {items.length}
            </Button>
          </footer>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  )
}
