import { useState } from 'react'
import { type ApplyPlan, type ApplyTarget } from '@/apply/types'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

interface TargetOption {
  id: string
  title: string
}

interface ApplyDialogProps {
  open: boolean
  onClose: () => void
  plan: ApplyPlan
  targets: TargetOption[]
  onConfirm: (target: ApplyTarget) => void
}

/**
 * Preview + confirm gate for the destructive apply. Nothing changes in Chrome
 * until the user reviews the plan (folders to create, bookmarks to move, target)
 * and confirms. Reassures the user that the change is reversible.
 */
export function ApplyDialog({ open, onClose, plan, targets, onConfirm }: ApplyDialogProps) {
  const [parentId, setParentId] = useState('')
  const [container, setContainer] = useState('LinkAtlas')

  if (!open) return null

  const effectiveParent = targets.some((t) => t.id === parentId) ? parentId : (targets[0]?.id ?? '')
  const canApply = plan.bookmarksToMove > 0 && effectiveParent !== '' && container.trim() !== ''

  const handleConfirm = () => {
    if (!canApply) return
    onConfirm({ parentId: effectiveParent, container: container.trim() })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <Icon name="upload" size={18} />
              Apply to Chrome
            </h2>
            <Button variant="ghost" onClick={onClose} title="Close">
              <Icon name="close" size={18} />
            </Button>
          </header>

          <div className="space-y-3 px-5 py-5 text-sm">
            <Row label="Categories" value={plan.assignments.length.toLocaleString()} />
            <Row label="Folders to create" value={`up to ${plan.foldersToCreate.toLocaleString()}`} />
            <Row label="Bookmarks to move" value={plan.bookmarksToMove.toLocaleString()} />

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Create under
              </span>
              <select
                value={effectiveParent}
                onChange={(event) => setParentId(event.target.value)}
                className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Container folder
              </span>
              <input
                value={container}
                onChange={(event) => setContainer(event.target.value)}
                className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
              />
            </label>

            <p className="rounded-md border border-border bg-surface-raised px-3 py-2 text-xs leading-relaxed text-muted">
              Categorized bookmarks are moved into <strong>{container || 'the container'}</strong> →
              category folders. Uncategorized bookmarks stay put, and original folders are kept. This
              is reversible — use <strong>Rollback</strong> afterwards to undo.
            </p>
          </div>

          <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!canApply}>
              <Icon name="upload" size={16} />
              Apply {plan.bookmarksToMove}
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
