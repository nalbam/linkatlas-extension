import { type DragEvent, useState } from 'react'
import { type BookmarkMetadata } from '@/metadata/types'
import { type Path, UNCATEGORIZED, hasPrefix, pathKey } from '@/organize/path'
import { type PathTreeNode } from '@/organize/types'
import { useUiStore } from '@/state/uiStore'
import { Button } from '@/ui/components/Button'
import { Favicon } from '@/ui/components/Favicon'
import { Icon } from '@/ui/components/Icon'

export const DRAG_MIME = 'application/x-linkatlas-urls'

/** A move/merge destination carrying BOTH the 大 root and the 中/小 path. */
export interface MoveTarget {
  key: string
  label: string
  rootId: string
  path: Path
}

/** Drag payload — bookmarks (url list) or a folder subtree (source 大 + path). */
export interface DragPayload {
  kind: 'bookmarks' | 'folder'
  urls?: string[]
  fromRootId?: string
  fromPath?: Path
}

interface PathNodeSectionProps {
  node: PathTreeNode
  rootId: string
  depth: number
  moveTargets: MoveTarget[]
  metadataByUrl: Record<string, BookmarkMetadata>
  overrideUrls: Set<string>
  selectedUrls: Set<string>
  onToggleSelect: (url: string) => void
  onOpen: (url: string) => void
  onMoveUrls: (urls: string[], toRootId: string, toPath: Path) => void
  onMoveFolder: (fromRootId: string, fromPath: Path, toRootId: string, toPath: Path) => void
  onRename: (node: PathTreeNode, draft: string) => void
  onMerge: (node: PathTreeNode, into: Path) => void
  onDelete: (node: PathTreeNode) => void
  onTogglePurpose: (segment: string) => void
}

function countSubtree(node: PathTreeNode): number {
  return node.bookmarks.length + node.children.reduce((sum, child) => sum + countSubtree(child), 0)
}

function parsePayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

export function PathNodeSection({
  node,
  rootId,
  depth,
  moveTargets,
  metadataByUrl,
  overrideUrls,
  selectedUrls,
  onToggleSelect,
  onOpen,
  onMoveUrls,
  onMoveFolder,
  onRename,
  onMerge,
  onDelete,
  onTogglePurpose,
}: PathNodeSectionProps) {
  const collapseKey = pathKey([rootId, ...node.path])
  const collapsed = useUiStore((s) => s.organizeCollapsed.has(collapseKey))
  const toggleCollapsed = useUiStore((s) => s.toggleOrganizeCollapsed)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(node.segment)
  const [dragOver, setDragOver] = useState(false)

  const isUncategorized = node.path[0] === UNCATEGORIZED
  const editable = !isUncategorized
  const isTopLevel = node.path.length === 1
  const total = countSubtree(node)

  // Merge only within the same 大; exclude self + descendants.
  const mergeTargets = moveTargets.filter((t) => t.rootId === rootId && !hasPrefix(t.path, node.path))

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    const payload = parsePayload(event)
    if (!payload) return
    if (payload.kind === 'folder' && payload.fromRootId !== undefined && payload.fromPath) {
      // Reject dropping a folder onto itself or its own descendant in the same 大.
      if (payload.fromRootId === rootId && hasPrefix(node.path, payload.fromPath)) return
      onMoveFolder(payload.fromRootId, payload.fromPath, rootId, node.path)
    } else if (payload.urls) {
      onMoveUrls(payload.urls, rootId, node.path)
    }
  }

  const startBookmarkDrag = (event: DragEvent, url: string) => {
    const urls = selectedUrls.has(url) && selectedUrls.size > 0 ? [...selectedUrls] : [url]
    const payload: DragPayload = { kind: 'bookmarks', urls }
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  const startFolderDrag = (event: DragEvent) => {
    event.stopPropagation()
    const payload: DragPayload = { kind: 'folder', fromRootId: rootId, fromPath: node.path }
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  const commitRename = () => {
    if (draft.trim() && draft.trim() !== node.segment) onRename(node, draft.trim())
    setRenaming(false)
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setDragOver(true)
      }}
      onDragLeave={(event) => {
        event.stopPropagation()
        setDragOver(false)
      }}
      onDrop={handleDrop}
      className={`rounded-lg border ${dragOver ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}
    >
      <header
        draggable={editable && !renaming}
        onDragStart={editable && !renaming ? startFolderDrag : undefined}
        className="flex items-center gap-2 px-3 py-2"
      >
        <button
          type="button"
          onClick={() => toggleCollapsed(collapseKey)}
          className={`text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <Icon name="chevron" size={14} />
        </button>

        {!isUncategorized && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              node.origin === 'purpose'
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-raised text-muted'
            }`}
          >
            {node.origin === 'purpose' ? '목적' : '분류'}
          </span>
        )}

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') setRenaming(false)
            }}
            className="rounded border border-border bg-canvas px-2 py-0.5 text-sm text-slate-100 focus:border-accent focus:outline-none"
          />
        ) : (
          <h3 className="truncate text-sm font-semibold text-slate-100">{node.segment}</h3>
        )}
        <span className="text-xs text-muted">{total}</span>

        {editable && !renaming && (
          <div className="ml-auto flex items-center gap-1">
            {isTopLevel && (
              <Button
                variant="ghost"
                onClick={() => onTogglePurpose(node.segment)}
                title={node.origin === 'purpose' ? 'Treat as category (use AI)' : 'Treat as purpose group'}
              >
                <Icon name={node.origin === 'purpose' ? 'folder' : 'tag'} size={15} />
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(node.segment)
                setRenaming(true)
              }}
              title="Rename"
            >
              <Icon name="edit" size={15} />
            </Button>
            {mergeTargets.length > 0 && (
              <select
                value=""
                onChange={(event) => {
                  const target = mergeTargets.find((t) => t.key === event.target.value)
                  if (target) onMerge(node, target.path)
                }}
                title="Merge into…"
                className="max-w-[8rem] rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-muted focus:border-accent focus:outline-none"
              >
                <option value="">Merge into…</option>
                {mergeTargets.map((target) => (
                  <option key={target.key} value={target.key}>
                    {target.label}
                  </option>
                ))}
              </select>
            )}
            <Button variant="ghost" onClick={() => onDelete(node)} title="Delete (reassign to Uncategorized)">
              <Icon name="trash" size={15} />
            </Button>
          </div>
        )}
      </header>

      {!collapsed && (
        <div className="border-t border-border">
          {node.bookmarks.length > 0 && (
            <ul className="max-h-80 overflow-auto">
              {node.bookmarks.map((bookmark) => {
                const selected = selectedUrls.has(bookmark.url)
                return (
                  <li
                    key={bookmark.id}
                    draggable
                    onDragStart={(event) => startBookmarkDrag(event, bookmark.url)}
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
                    {overrideUrls.has(bookmark.url) && (
                      <span
                        className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                        title="수동으로 이동됨 — AI 재정리에서 유지됩니다"
                      >
                        수동
                      </span>
                    )}
                    {bookmark.domain && (
                      <span className="max-w-[35%] shrink-0 truncate text-xs text-muted">
                        {bookmark.domain}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {node.children.length > 0 && (
            <div className="space-y-2 p-2 pl-4">
              {node.children.map((child) => (
                <PathNodeSection
                  key={pathKey(child.path)}
                  node={child}
                  rootId={rootId}
                  depth={depth + 1}
                  moveTargets={moveTargets}
                  metadataByUrl={metadataByUrl}
                  overrideUrls={overrideUrls}
                  selectedUrls={selectedUrls}
                  onToggleSelect={onToggleSelect}
                  onOpen={onOpen}
                  onMoveUrls={onMoveUrls}
                  onMoveFolder={onMoveFolder}
                  onRename={onRename}
                  onMerge={onMerge}
                  onDelete={onDelete}
                  onTogglePurpose={onTogglePurpose}
                />
              ))}
            </div>
          )}

          {node.bookmarks.length === 0 && node.children.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted">Empty — drag bookmarks here.</p>
          )}
        </div>
      )}
    </section>
  )
}
