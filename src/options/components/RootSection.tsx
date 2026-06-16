import { type DragEvent, useState } from 'react'
import { type BookmarkMetadata } from '@/metadata/types'
import { type Path, pathKey } from '@/organize/path'
import { type PathTreeNode, type RootTreeNode } from '@/organize/types'
import { useUiStore } from '@/state/uiStore'
import { Icon } from '@/ui/components/Icon'
import { DRAG_MIME, type DragPayload, type MoveTarget, PathNodeSection } from './CategorySection'

interface RootSectionProps {
  root: RootTreeNode
  moveTargets: MoveTarget[]
  metadataByUrl: Record<string, BookmarkMetadata>
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

/**
 * A read-only 大 (browser root) wrapper: shows the root title + count and
 * renders its 中/小 forest. The root itself can't be renamed/deleted, but it is
 * a drop zone for FOLDERS — dropping a folder here moves the whole subtree into
 * this 大, keeping its path (only the 大 changes).
 */
export function RootSection({
  root,
  moveTargets,
  metadataByUrl,
  selectedUrls,
  onToggleSelect,
  onOpen,
  onMoveUrls,
  onMoveFolder,
  onRename,
  onMerge,
  onDelete,
  onTogglePurpose,
}: RootSectionProps) {
  const collapseKey = pathKey([root.rootId])
  const collapsed = useUiStore((s) => s.organizeCollapsed.has(collapseKey))
  const toggleCollapsed = useUiStore((s) => s.toggleOrganizeCollapsed)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    const raw = event.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    let payload: DragPayload
    try {
      payload = JSON.parse(raw) as DragPayload
    } catch {
      return
    }
    // Bare 大 accepts folder drops only (bookmark drops are ambiguous here).
    if (payload.kind === 'folder' && payload.fromRootId !== undefined && payload.fromPath) {
      if (payload.fromRootId === root.rootId) return // already in this 大
      onMoveFolder(payload.fromRootId, payload.fromPath, root.rootId, payload.fromPath)
    }
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-xl border-2 ${dragOver ? 'border-accent bg-accent/5' : 'border-border bg-canvas'}`}
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => toggleCollapsed(collapseKey)}
          className={`text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <Icon name="chevron" size={14} />
        </button>
        <Icon name="folder" size={16} />
        <h2 className="truncate text-sm font-bold text-slate-100">{root.title}</h2>
        <span className="text-xs text-muted">{root.bookmarkCount}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted">root</span>
      </header>

      {!collapsed && (
        <div className="space-y-2 border-t border-border p-2">
          {root.children.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">Empty — drag folders here.</p>
          ) : (
            root.children.map((child) => (
              <PathNodeSection
                key={pathKey(child.path)}
                node={child}
                rootId={root.rootId}
                depth={0}
                moveTargets={moveTargets}
                metadataByUrl={metadataByUrl}
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
            ))
          )}
        </div>
      )}
    </section>
  )
}
