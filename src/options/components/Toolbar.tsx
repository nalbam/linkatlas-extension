import { useEffect, useState } from 'react'
import { type SortKey } from '@/bookmarks/types'
import { useUiStore } from '@/state/uiStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'
import { SearchInput } from '@/ui/components/SearchInput'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'manual', label: 'Original order' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'domain', label: 'Domain' },
  { value: 'recent', label: 'Recently added' },
  { value: 'importance', label: 'Importance' },
]

const selectClass =
  'rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none'

interface ToolbarProps {
  domains: string[]
  categories: string[]
  onExpandAll: () => void
  onCollapseAll: () => void
  onRefresh: () => void
}

export function Toolbar({ domains, categories, onExpandAll, onCollapseAll, onRefresh }: ToolbarProps) {
  const {
    domainFilter,
    categoryFilter,
    tagFilter,
    sortKey,
    setSearchQuery,
    setDomainFilter,
    setCategoryFilter,
    setTagFilter,
    setSortKey,
  } = useUiStore()

  // Local text drives an immediate input while the store update is debounced,
  // so typing never re-runs the full filter pipeline on every keystroke.
  const [text, setText] = useState('')
  const debounced = useDebouncedValue(text, 200)
  useEffect(() => {
    setSearchQuery(debounced)
  }, [debounced, setSearchQuery])

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/60 px-4 py-3">
      <SearchInput value={text} onChange={setText} placeholder="Search title, URL or domain…" />

      <select
        className={selectClass}
        value={domainFilter}
        onChange={(event) => setDomainFilter(event.target.value)}
        aria-label="Filter by domain"
      >
        <option value="">All domains</option>
        {domains.map((domain) => (
          <option key={domain} value={domain}>
            {domain}
          </option>
        ))}
      </select>

      {categories.length > 0 && (
        <select
          className={selectClass}
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      )}

      {tagFilter && (
        <button
          type="button"
          onClick={() => setTagFilter('')}
          title="Clear tag filter"
          className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2 py-1.5 text-sm text-slate-100"
        >
          <Icon name="tag" size={14} />
          {tagFilter}
          <Icon name="close" size={14} />
        </button>
      )}

      <select
        className={selectClass}
        value={sortKey}
        onChange={(event) => setSortKey(event.target.value as SortKey)}
        aria-label="Sort order"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={onExpandAll} title="Expand all">
          <Icon name="expand" size={16} />
        </Button>
        <Button variant="ghost" onClick={onCollapseAll} title="Collapse all">
          <Icon name="collapse" size={16} />
        </Button>
        <Button variant="ghost" onClick={onRefresh} title="Reload bookmarks">
          <Icon name="refresh" size={16} />
        </Button>
      </div>
    </div>
  )
}
