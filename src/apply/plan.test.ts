import { describe, expect, it } from 'vitest'
import { UNCATEGORIZED } from '@/organize/operations'
import { type CategoryGroup } from '@/organize/types'
import { type BookmarkNode } from '@/bookmarks/types'
import { buildApplyPlan } from './plan'

function bookmark(id: string): BookmarkNode {
  return { type: 'bookmark', id, title: id, index: 0, url: `u:${id}`, domain: '' }
}
function group(category: string, ids: string[]): CategoryGroup {
  return { category, bookmarks: ids.map(bookmark) }
}

describe('buildApplyPlan', () => {
  it('excludes Uncategorized and empty categories and counts folders + moves', () => {
    const groups = [
      group('Dev', ['a', 'b']),
      group('Reading', []), // empty → excluded
      group(UNCATEGORIZED, ['c']), // excluded
    ]
    const plan = buildApplyPlan(groups)
    expect(plan.assignments).toEqual([{ category: 'Dev', bookmarkIds: ['a', 'b'] }])
    expect(plan.bookmarksToMove).toBe(2)
    expect(plan.foldersToCreate).toBe(2) // container + Dev
  })

  it('returns an empty plan when nothing is categorized', () => {
    const plan = buildApplyPlan([group(UNCATEGORIZED, ['a'])])
    expect(plan.assignments).toEqual([])
    expect(plan.foldersToCreate).toBe(0)
    expect(plan.bookmarksToMove).toBe(0)
  })
})
