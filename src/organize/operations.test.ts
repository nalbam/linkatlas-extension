import { describe, expect, it } from 'vitest'
import { type StoredAnalysis } from '@/analysis/types'
import { type BookmarkNode } from '@/bookmarks/types'
import {
  EMPTY_ORGANIZE,
  UNCATEGORIZED,
  createCategory,
  deleteCategory,
  effectiveCategory,
  groupByCategory,
  mergeCategories,
  moveBookmarks,
  renameCategory,
} from './operations'
import { type OrganizeState } from './types'

function bookmark(id: string, url: string): BookmarkNode {
  return { type: 'bookmark', id, title: id, index: 0, url, domain: '' }
}
function analysis(category: string): StoredAnalysis {
  return {
    url: '',
    status: 'ok',
    analyzedAt: 0,
    model: 't',
    summary: '',
    category,
    subcategory: '',
    tags: [],
    importance: 0,
    reason: '',
  }
}

const bookmarks = [bookmark('a', 'u:a'), bookmark('b', 'u:b'), bookmark('c', 'u:c')]
const analysisByUrl = {
  'u:a': analysis('Dev'),
  'u:b': analysis('Dev'),
  // u:c has no analysis → Uncategorized
}

describe('effectiveCategory', () => {
  it('prefers override, then AI category, then Uncategorized', () => {
    expect(effectiveCategory('u:a', analysisByUrl, EMPTY_ORGANIZE)).toBe('Dev')
    expect(effectiveCategory('u:c', analysisByUrl, EMPTY_ORGANIZE)).toBe(UNCATEGORIZED)
    const withOverride: OrganizeState = { overrides: { 'u:a': 'AI' }, extraCategories: [] }
    expect(effectiveCategory('u:a', analysisByUrl, withOverride)).toBe('AI')
  })
})

describe('groupByCategory', () => {
  it('groups by effective category, Uncategorized last, includes empty created categories', () => {
    const state: OrganizeState = { overrides: {}, extraCategories: ['Reading'] }
    const groups = groupByCategory(bookmarks, analysisByUrl, state)
    expect(groups.map((g) => g.category)).toEqual(['Dev', 'Reading', UNCATEGORIZED])
    expect(groups.find((g) => g.category === 'Dev')?.bookmarks).toHaveLength(2)
    expect(groups.find((g) => g.category === 'Reading')?.bookmarks).toHaveLength(0)
  })
})

describe('mutations', () => {
  it('createCategory adds without duplicates and ignores blanks', () => {
    const s1 = createCategory(EMPTY_ORGANIZE, 'News')
    expect(s1.extraCategories).toEqual(['News'])
    expect(createCategory(s1, 'News')).toBe(s1)
    expect(createCategory(s1, '   ')).toBe(s1)
  })

  it('moveBookmarks assigns overrides', () => {
    const s = moveBookmarks(EMPTY_ORGANIZE, ['u:a', 'u:c'], 'News')
    expect(s.overrides).toEqual({ 'u:a': 'News', 'u:c': 'News' })
  })

  it('renameCategory reassigns members and renames the created category', () => {
    const state: OrganizeState = { overrides: {}, extraCategories: ['Dev'] }
    const s = renameCategory(state, 'Dev', 'Engineering', ['u:a', 'u:b'])
    expect(s.overrides).toEqual({ 'u:a': 'Engineering', 'u:b': 'Engineering' })
    expect(s.extraCategories).toEqual(['Engineering'])
  })

  it('mergeCategories reassigns and drops the source categories', () => {
    const state: OrganizeState = { overrides: {}, extraCategories: ['Dev', 'Tools'] }
    const s = mergeCategories(state, ['Dev', 'Tools'], 'Work', ['u:a', 'u:b'])
    expect(s.overrides).toEqual({ 'u:a': 'Work', 'u:b': 'Work' })
    expect(s.extraCategories).toEqual([])
  })

  it('deleteCategory reassigns members to Uncategorized and removes it', () => {
    const state: OrganizeState = { overrides: { 'u:a': 'Temp' }, extraCategories: ['Temp'] }
    const s = deleteCategory(state, 'Temp', ['u:a'])
    expect(s.overrides['u:a']).toBe(UNCATEGORIZED)
    expect(s.extraCategories).toEqual([])
  })
})
