import { describe, expect, it } from 'vitest'
import { extractDomain } from '@/bookmarks/tree'
import { type BookmarkNode, type FolderNode, type TreeNode } from '@/bookmarks/types'
import { selectVisibleRows, type ViewState } from './selectors'

function bookmark(id: string, title: string, url: string, index = 0): BookmarkNode {
  return { type: 'bookmark', id, title, index, url, domain: extractDomain(url) }
}
function folder(id: string, title: string, children: TreeNode[]): FolderNode {
  return { type: 'folder', id, title, index: 0, children }
}

function tree(): TreeNode[] {
  return [
    folder('bar', 'Bar', [
      folder('dev', 'Dev', [
        bookmark('b1', 'React', 'https://react.dev', 0),
        bookmark('b2', 'Vue', 'https://vuejs.org', 1),
      ]),
    ]),
  ]
}

const base: ViewState = {
  searchQuery: '',
  domainFilter: '',
  categoryFilter: '',
  tagFilter: '',
  sortKey: 'manual',
  expandedIds: new Set(),
}

describe('selectVisibleRows', () => {
  it('shows only collapsed roots by default', () => {
    const rows = selectVisibleRows(tree(), base)
    expect(rows.map((r) => r.node.title)).toEqual(['Bar'])
  })

  it('reveals children when their folders are expanded', () => {
    const rows = selectVisibleRows(tree(), { ...base, expandedIds: new Set(['bar', 'dev']) })
    expect(rows.map((r) => r.node.title)).toEqual(['Bar', 'Dev', 'React', 'Vue'])
  })

  it('auto-expands matching paths while searching', () => {
    const rows = selectVisibleRows(tree(), { ...base, searchQuery: 'react' })
    expect(rows.map((r) => r.node.title)).toEqual(['Bar', 'Dev', 'React'])
  })

  it('applies domain filter then search together', () => {
    const rows = selectVisibleRows(tree(), { ...base, domainFilter: 'vuejs.org' })
    expect(rows.map((r) => r.node.title)).toEqual(['Bar', 'Dev', 'Vue'])
  })

  it('sorts leaves by title', () => {
    const rows = selectVisibleRows(tree(), {
      ...base,
      sortKey: 'title',
      expandedIds: new Set(['bar', 'dev']),
    })
    expect(rows.filter((r) => r.node.type === 'bookmark').map((r) => r.node.title)).toEqual([
      'React',
      'Vue',
    ])
  })
})

describe('selectVisibleRows with analysis', () => {
  const analysis = {
    'https://react.dev': storedAnalysis({ category: 'Development', tags: ['ui'], importance: 9 }),
    'https://vuejs.org': storedAnalysis({ category: 'Learning', tags: ['ui', 'docs'], importance: 4 }),
  }
  const expanded = new Set(['bar', 'dev'])

  it('sorts leaves by importance (highest first)', () => {
    const rows = selectVisibleRows(tree(), { ...base, sortKey: 'importance', expandedIds: expanded }, analysis)
    expect(rows.filter((r) => r.node.type === 'bookmark').map((r) => r.node.title)).toEqual([
      'React',
      'Vue',
    ])
  })

  it('filters by category', () => {
    const rows = selectVisibleRows(tree(), { ...base, categoryFilter: 'Learning' }, analysis)
    expect(rows.map((r) => r.node.title)).toEqual(['Bar', 'Dev', 'Vue'])
  })

  it('filters by tag', () => {
    const rows = selectVisibleRows(tree(), { ...base, tagFilter: 'docs' }, analysis)
    expect(rows.map((r) => r.node.title)).toEqual(['Bar', 'Dev', 'Vue'])
  })
})

function storedAnalysis(partial: { category: string; tags: string[]; importance: number }) {
  return {
    url: '',
    status: 'ok' as const,
    analyzedAt: 0,
    model: 'test',
    summary: '',
    subcategory: '',
    reason: '',
    ...partial,
  }
}
