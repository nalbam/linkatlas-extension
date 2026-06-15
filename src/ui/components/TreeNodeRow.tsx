import { type FlatNode } from '@/bookmarks/types'
import { Icon } from './Icon'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeNodeRowProps {
  row: FlatNode
  onToggle: (id: string) => void
  onOpen: (url: string) => void
}

export function TreeNodeRow({ row, onToggle, onOpen }: TreeNodeRowProps) {
  const { node, depth, hasChildren, isExpanded } = row
  const paddingLeft = BASE_PADDING_PX + depth * INDENT_PX

  if (node.type === 'folder') {
    return (
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        style={{ paddingLeft }}
        className="flex h-full w-full items-center gap-1.5 pr-3 text-left hover:bg-surface-raised"
      >
        <span
          className={`text-muted transition-transform ${isExpanded ? 'rotate-90' : ''} ${hasChildren ? '' : 'opacity-0'}`}
        >
          <Icon name="chevron" size={14} />
        </span>
        <span className="text-amber-300/90">
          <Icon name={isExpanded ? 'folderOpen' : 'folder'} size={16} />
        </span>
        <span className="truncate text-sm font-medium text-slate-100">
          {node.title || 'Untitled folder'}
        </span>
        {hasChildren && (
          <span className="ml-1 text-xs text-muted">{node.children.length}</span>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(node.url)}
      title={node.url}
      style={{ paddingLeft: paddingLeft + INDENT_PX }}
      className="flex h-full w-full items-center gap-1.5 pr-3 text-left hover:bg-surface-raised"
    >
      <span className="text-sky-300/80">
        <Icon name="globe" size={15} />
      </span>
      <span className="truncate text-sm text-slate-200">
        {node.title || node.url}
      </span>
      {node.domain && (
        <span className="ml-auto shrink-0 truncate pl-2 text-xs text-muted">{node.domain}</span>
      )}
    </button>
  )
}
