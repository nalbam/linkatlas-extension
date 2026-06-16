import { type ApplyPlan } from '@/apply/types'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

interface ApplyDialogProps {
  open: boolean
  onClose: () => void
  plan: ApplyPlan
  onConfirm: () => void
}

/**
 * Preview + confirm gate for the destructive apply. Nothing changes in Chrome
 * until the user reviews the plan and confirms. Each bookmark's folder path is
 * created directly under its assigned 大 root (bookmark bar / other); existing
 * same-named folders are reused and rollback removes only the folders this apply
 * created.
 */
export function ApplyDialog({ open, onClose, plan, onConfirm }: ApplyDialogProps) {
  if (!open) return null

  const canApply = plan.bookmarksToMove > 0

  const handleConfirm = () => {
    if (!canApply) return
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
              <Icon name="upload" size={18} />
              Apply to Chrome
            </h2>
            <Button variant="ghost" onClick={onClose} title="Close">
              <Icon name="close" size={18} />
            </Button>
          </header>

          <div className="space-y-3 px-5 py-5 text-sm">
            <Row label="Groups" value={plan.assignments.length.toLocaleString()} />
            <Row label="Folders to create" value={`up to ${plan.foldersToCreate.toLocaleString()}`} />
            <Row label="Bookmarks to move" value={plan.bookmarksToMove.toLocaleString()} />

            <p className="rounded-md border border-border bg-surface-raised px-3 py-2 text-xs leading-relaxed text-muted">
              Each bookmark's folder path is created under its assigned root
              (북마크바 / 기타 북마크), nested by path. Existing same-named folders are reused;
              Uncategorized bookmarks stay put. This is reversible — use <strong>Rollback</strong>
              afterwards, which removes only the folders this apply created.
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
