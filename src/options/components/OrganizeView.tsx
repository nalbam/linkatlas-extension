import { useMemo, useState } from 'react'
import { type StoredAnalysis } from '@/analysis/types'
import { collectBookmarks } from '@/bookmarks/tree'
import { type TreeNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { UNCATEGORIZED, groupByCategory } from '@/organize/operations'
import { useOrganizeStore } from '@/state/organizeStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'
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

  const bookmarks = useMemo(() => collectBookmarks(roots), [roots])
  const groups = useMemo(
    () => groupByCategory(bookmarks, analysisByUrl, organize),
    [bookmarks, analysisByUrl, organize],
  )
  const categoryNames = useMemo(() => groups.map((g) => g.category), [groups])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [moveTarget, setMoveTarget] = useState('')

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
    </div>
  )
}
