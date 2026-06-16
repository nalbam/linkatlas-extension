import { describe, expect, it } from 'vitest'
import { type BookmarkNode } from '@/bookmarks/types'
import { UNCATEGORIZED } from '@/organize/operations'
import { type Path } from '@/organize/path'
import { type PathTreeNode, type RootTreeNode } from '@/organize/types'
import { buildApplyPlan } from './plan'

function node(path: Path, ids: string[], children: PathTreeNode[] = []): PathTreeNode {
  const bookmarks: BookmarkNode[] = ids.map((id) => ({
    type: 'bookmark',
    id,
    title: id,
    index: 0,
    url: `u:${id}`,
    domain: '',
  }))
  return { segment: path[path.length - 1], path, origin: 'category', bookmarks, children }
}

function root(rootId: string, title: string, children: PathTreeNode[]): RootTreeNode {
  return { rootId, title, children, bookmarkCount: 0 }
}

describe('buildApplyPlan', () => {
  it('emits one assignment per node holding bookmarks, stamped with its root id', () => {
    const forest: RootTreeNode[] = [
      root('1', 'Bar', [node(['karrot'], [], [node(['karrot', 'pay'], ['a', 'b'])])]),
      root('2', 'Other', [node(['Games'], ['c']), node([UNCATEGORIZED], ['d'])]),
    ]
    const plan = buildApplyPlan(forest)
    expect(plan.assignments).toEqual([
      { rootId: '1', path: ['karrot', 'pay'], bookmarkIds: ['a', 'b'] },
      { rootId: '2', path: ['Games'], bookmarkIds: ['c'] },
    ])
    expect(plan.bookmarksToMove).toBe(3)
    // root1: karrot, karrot/pay (2) + root2: Games (1) = 3
    expect(plan.foldersToCreate).toBe(3)
  })

  it('counts the same path name under two roots separately', () => {
    const forest: RootTreeNode[] = [
      root('1', 'Bar', [node(['Games'], ['a'])]),
      root('2', 'Other', [node(['Games'], ['b'])]),
    ]
    const plan = buildApplyPlan(forest)
    expect(plan.assignments).toHaveLength(2)
    expect(plan.foldersToCreate).toBe(2) // Games under root 1 and under root 2 are distinct
  })

  it('returns an empty plan when only Uncategorized has members', () => {
    const plan = buildApplyPlan([root('1', 'Bar', [node([UNCATEGORIZED], ['a'])])])
    expect(plan.assignments).toEqual([])
    expect(plan.foldersToCreate).toBe(0)
    expect(plan.bookmarksToMove).toBe(0)
  })
})
