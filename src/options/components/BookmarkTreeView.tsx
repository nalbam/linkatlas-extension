import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type StoredAnalysis } from '@/analysis/types'
import { type FlatNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { TreeNodeRow } from '@/ui/components/TreeNodeRow'

const ROW_HEIGHT = 34

interface BookmarkTreeViewProps {
  rows: FlatNode[]
  metadataByUrl: Record<string, BookmarkMetadata>
  analysisByUrl: Record<string, StoredAnalysis>
  onToggle: (id: string) => void
  onOpen: (url: string) => void
}

/**
 * Windowed render of the flattened tree. Only the visible rows (plus a small
 * overscan) are mounted, so 10k+ bookmarks stay smooth. Row identity is keyed
 * by node id so scroll position survives search/filter changes.
 */
export function BookmarkTreeView({
  rows,
  metadataByUrl,
  analysisByUrl,
  onToggle,
  onOpen,
}: BookmarkTreeViewProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14,
    getItemKey: (index) => rows[index].node.id,
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          const url = row.node.type === 'bookmark' ? row.node.url : undefined
          const metadata = url ? metadataByUrl[url] : undefined
          const analysis = url ? analysisByUrl[url] : undefined
          return (
            <div
              key={item.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <TreeNodeRow
                row={row}
                metadata={metadata}
                analysis={analysis}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
