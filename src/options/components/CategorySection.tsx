import { type DragEvent, useState } from 'react'
import { type CategoryGroup } from '@/organize/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { Button } from '@/ui/components/Button'
import { Favicon } from '@/ui/components/Favicon'
import { Icon } from '@/ui/components/Icon'

const DRAG_MIME = 'application/x-linkatlas-urls'

interface CategorySectionProps {
  group: CategoryGroup
  otherCategories: string[]
  metadataByUrl: Record<string, BookmarkMetadata>
  selectedUrls: Set<string>
  editable: boolean
  onToggleSelect: (url: string) => void
  onOpen: (url: string) => void
  onDropUrls: (urls: string[]) => void
  onRename: (to: string) => void
  onMerge: (into: string) => void
  onDelete: () => void
}

export function CategorySection({
  group,
  otherCategories,
  metadataByUrl,
  selectedUrls,
  editable,
  onToggleSelect,
  onOpen,
  onDropUrls,
  onRename,
  onMerge,
  onDelete,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(group.category)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const raw = event.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    try {
      const urls = JSON.parse(raw) as string[]
      onDropUrls(urls)
    } catch {
      /* ignore malformed payload */
    }
  }

  const startDrag = (event: DragEvent, url: string) => {
    const urls = selectedUrls.has(url) && selectedUrls.size > 0 ? [...selectedUrls] : [url]
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(urls))
    event.dataTransfer.effectAllowed = 'move'
  }

  const commitRename = () => {
    if (draftName.trim() && draftName.trim() !== group.category) onRename(draftName.trim())
    setRenaming(false)
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-lg border ${dragOver ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={`text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <Icon name="chevron" size={14} />
        </button>

        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') setRenaming(false)
            }}
            className="rounded border border-border bg-canvas px-2 py-0.5 text-sm text-slate-100 focus:border-accent focus:outline-none"
          />
        ) : (
          <h3 className="truncate text-sm font-semibold text-slate-100">{group.category}</h3>
        )}
        <span className="text-xs text-muted">{group.bookmarks.length}</span>

        {editable && !renaming && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => {
                setDraftName(group.category)
                setRenaming(true)
              }}
              title="Rename"
            >
              <Icon name="edit" size={15} />
            </Button>
            {otherCategories.length > 0 && (
              <select
                value=""
                onChange={(event) => event.target.value && onMerge(event.target.value)}
                title="Merge into…"
                className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-muted focus:border-accent focus:outline-none"
              >
                <option value="">Merge into…</option>
                {otherCategories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="ghost" onClick={onDelete} title="Delete (reassign to Uncategorized)">
              <Icon name="trash" size={15} />
            </Button>
          </div>
        )}
      </header>

      {!collapsed && (
        <ul className="max-h-80 overflow-auto border-t border-border">
          {group.bookmarks.length === 0 ? (
            <li className="px-3 py-3 text-xs text-muted">Empty — drag bookmarks here.</li>
          ) : (
            group.bookmarks.map((bookmark) => {
              const selected = selectedUrls.has(bookmark.url)
              return (
                <li
                  key={bookmark.id}
                  draggable
                  onDragStart={(event) => startDrag(event, bookmark.url)}
                  className={`flex items-center gap-2 px-3 py-1.5 ${selected ? 'bg-accent/10' : 'hover:bg-surface-raised'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelect(bookmark.url)}
                    className="shrink-0 accent-accent"
                  />
                  <Favicon src={metadataByUrl[bookmark.url]?.faviconUrl} />
                  <button
                    type="button"
                    onClick={() => onOpen(bookmark.url)}
                    title={bookmark.url}
                    className="min-w-0 flex-1 truncate text-left text-sm text-slate-200"
                  >
                    {bookmark.title || bookmark.url}
                  </button>
                  {bookmark.domain && (
                    <span className="max-w-[35%] shrink-0 truncate text-xs text-muted">
                      {bookmark.domain}
                    </span>
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </section>
  )
}
