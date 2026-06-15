import { useState } from 'react'
import { type FlatNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { Icon } from './Icon'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeNodeRowProps {
  row: FlatNode
  metadata?: BookmarkMetadata
  onToggle: (id: string) => void
  onOpen: (url: string) => void
}

export function TreeNodeRow({ row, metadata, onToggle, onOpen }: TreeNodeRowProps) {
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
        {hasChildren && <span className="ml-1 text-xs text-muted">{node.children.length}</span>}
      </button>
    )
  }

  const secondary = metadata?.description ?? node.domain
  const tooltip = metadata?.description ? `${node.title}\n${node.url}` : node.url

  return (
    <button
      type="button"
      onClick={() => onOpen(node.url)}
      title={tooltip}
      style={{ paddingLeft: paddingLeft + INDENT_PX }}
      className="flex h-full w-full items-center gap-1.5 pr-3 text-left hover:bg-surface-raised"
    >
      <Favicon src={metadata?.faviconUrl} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{node.title || node.url}</span>
      {secondary && (
        <span className="max-w-[45%] shrink-0 truncate pl-3 text-right text-xs text-muted">
          {secondary}
        </span>
      )}
    </button>
  )
}

/** Favicon image with a graceful globe fallback on load error or when absent. */
function Favicon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className="shrink-0 text-sky-300/80">
        <Icon name="globe" size={15} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      width={15}
      height={15}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[15px] w-[15px] shrink-0 rounded-sm"
    />
  )
}
