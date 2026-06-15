import { useState } from 'react'
import { type StoredAnalysis } from '@/analysis/types'
import { type FlatNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { Icon } from './Icon'

const INDENT_PX = 16
const BASE_PADDING_PX = 8

interface TreeNodeRowProps {
  row: FlatNode
  metadata?: BookmarkMetadata
  analysis?: StoredAnalysis
  onToggle: (id: string) => void
  onOpen: (url: string) => void
}

export function TreeNodeRow({ row, metadata, analysis, onToggle, onOpen }: TreeNodeRowProps) {
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

  const analyzed = analysis?.status === 'ok' ? analysis : undefined
  const secondary = metadata?.description ?? node.domain
  const tooltip = analyzed
    ? [node.title, analyzed.summary, analyzed.tags.length ? `Tags: ${analyzed.tags.join(', ')}` : '', node.url]
        .filter(Boolean)
        .join('\n')
    : metadata?.description
      ? `${node.title}\n${node.url}`
      : node.url

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
      {analyzed ? (
        <>
          {analyzed.category && (
            <span className="max-w-[28%] shrink-0 truncate rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-slate-300">
              {analyzed.category}
            </span>
          )}
          <ImportanceBadge value={analyzed.importance} />
        </>
      ) : (
        secondary && (
          <span className="max-w-[45%] shrink-0 truncate pl-3 text-right text-xs text-muted">
            {secondary}
          </span>
        )
      )}
    </button>
  )
}

function ImportanceBadge({ value }: { value: number }) {
  const tone =
    value >= 7
      ? 'bg-emerald-500/20 text-emerald-300'
      : value >= 4
        ? 'bg-amber-500/20 text-amber-300'
        : 'bg-slate-500/20 text-slate-300'
  return (
    <span
      title={`Importance ${value}/10`}
      className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
    >
      {value}
    </span>
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
