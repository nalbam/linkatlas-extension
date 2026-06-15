import { useEffect, useMemo, useState } from 'react'
import { type StoredAnalysis } from '@/analysis/types'
import { buildApplyPlan } from '@/apply/plan'
import { collectBookmarks } from '@/bookmarks/tree'
import { isFolder, type TreeNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { UNCATEGORIZED, groupByCategory } from '@/organize/operations'
import { useApplyStore } from '@/state/applyStore'
import { useOrganizeStore } from '@/state/organizeStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'
import { ApplyDialog } from './ApplyDialog'
import { CategorySection } from './CategorySection'

interface OrganizeViewProps {
  roots: TreeNode[]
  analysisByUrl: Record<string, StoredAnalysis>
  metadataByUrl: Record<string, BookmarkMetadata>
  onOpen: (url: string) => void
}

export function OrganizeView({ roots, analysisByUrl, metadataByUrl, onOpen }: OrganizeViewProps) {
  const organize = useOrganizeStore((s) => s.organize)
  const historyLength = useOrganizeStore((s) => s.history.length)
  const createCategory = useOrganizeStore((s) => s.createCategory)
  const moveBookmarks = useOrganizeStore((s) => s.moveBookmarks)
  const renameCategory = useOrganizeStore((s) => s.renameCategory)
  const mergeCategories = useOrganizeStore((s) => s.mergeCategories)
  const deleteCategory = useOrganizeStore((s) => s.deleteCategory)
  const undo = useOrganizeStore((s) => s.undo)

  const applyJob = useApplyStore((s) => s.job)
  const lastSummary = useApplyStore((s) => s.lastSummary)
  const hasSnapshot = useApplyStore((s) => s.hasSnapshot)
  const applyError = useApplyStore((s) => s.error)
  const startApply = useApplyStore((s) => s.startApply)
  const rollback = useApplyStore((s) => s.rollback)
  const refreshSnapshotFlag = useApplyStore((s) => s.refreshSnapshotFlag)

  const bookmarks = useMemo(() => collectBookmarks(roots), [roots])
  const groups = useMemo(
    () => groupByCategory(bookmarks, analysisByUrl, organize),
    [bookmarks, analysisByUrl, organize],
  )
  const categoryNames = useMemo(() => groups.map((g) => g.category), [groups])
  const plan = useMemo(() => buildApplyPlan(groups), [groups])
  const targets = useMemo(
    () => roots.filter(isFolder).map((r) => ({ id: r.id, title: r.title || 'Bookmarks' })),
    [roots],
  )

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [moveTarget, setMoveTarget] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)

  // Detect whether a previous apply can still be rolled back.
  useEffect(() => {
    void refreshSnapshotFlag()
  }, [refreshSnapshotFlag])

  const toggleSelect = (url: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })

  const handleCreate = () => {
    if (!newName.trim()) return
    createCategory(newName)
    setNewName('')
  }

  const handleMoveSelected = () => {
    if (!moveTarget || selected.size === 0) return
    moveBookmarks([...selected], moveTarget)
    setSelected(new Set())
    setMoveTarget('')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/40 px-4 py-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
          placeholder="New category"
          className="w-44 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <Button variant="default" onClick={handleCreate} disabled={!newName.trim()}>
          <Icon name="plus" size={16} />
          Add
        </Button>
        <Button variant="ghost" onClick={undo} disabled={historyLength === 0} title="Undo last change">
          <Icon name="undo" size={16} />
          Undo
        </Button>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted">{selected.size} selected</span>
            <select
              value={moveTarget}
              onChange={(event) => setMoveTarget(event.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none"
            >
              <option value="">Move to…</option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={handleMoveSelected} disabled={!moveTarget}>
              Move
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/40 px-4 py-2">
        {applyJob.running ? (
          <div className="flex flex-1 items-center gap-3">
            <span className="shrink-0 text-sm text-slate-200">
              {applyJob.mode === 'rollback' ? 'Rolling back' : 'Applying'}… {applyJob.done}/
              {applyJob.total}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${applyJob.total ? Math.round((applyJob.done / applyJob.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={() => setApplyOpen(true)}
              disabled={plan.bookmarksToMove === 0}
              title="Create category folders and move bookmarks in Chrome"
            >
              <Icon name="upload" size={16} />
              {plan.bookmarksToMove > 0 ? `Apply to Chrome · ${plan.bookmarksToMove}` : 'Nothing to apply'}
            </Button>
            {hasSnapshot && (
              <Button variant="default" onClick={rollback} title="Undo the last apply">
                <Icon name="undo" size={16} />
                Rollback
              </Button>
            )}
            {lastSummary && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <Icon name="check" size={14} />
                {lastSummary.created} folders · {lastSummary.moved} moved
              </span>
            )}
            {applyError && <span className="text-xs text-rose-300">{applyError}</span>}
          </>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {bookmarks.length === 0 ? (
          <p className="text-sm text-muted">No bookmarks to organize.</p>
        ) : (
          groups.map((group) => {
            const urls = group.bookmarks.map((b) => b.url)
            return (
              <CategorySection
                key={group.category}
                group={group}
                otherCategories={categoryNames.filter((c) => c !== group.category)}
                metadataByUrl={metadataByUrl}
                selectedUrls={selected}
                editable={group.category !== UNCATEGORIZED}
                onToggleSelect={toggleSelect}
                onOpen={onOpen}
                onDropUrls={(dropped) => moveBookmarks(dropped, group.category)}
                onRename={(to) => renameCategory(group.category, to, urls)}
                onMerge={(into) => mergeCategories([group.category], into, urls)}
                onDelete={() => deleteCategory(group.category, urls)}
              />
            )
          })
        )}
      </div>

      <ApplyDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        plan={plan}
        targets={targets}
        onConfirm={(target) => startApply({ assignments: plan.assignments, target })}
      />
    </div>
  )
}
