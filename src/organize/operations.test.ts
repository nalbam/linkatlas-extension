import { describe, expect, it } from 'vitest'
import { type StoredAnalysis } from '@/analysis/types'
import { type BookmarkNode } from '@/bookmarks/types'
import {
  EMPTY_ORGANIZE,
  type Placement,
  type RootPlacement,
  UNCATEGORIZED,
  buildPathTree,
  buildRootTree,
  createPath,
  deletePath,
  mergePaths,
  moveBookmarks,
  moveBookmarksToRoot,
  moveSubtreeToRoot,
  renamePath,
  togglePurposeRoot,
} from './operations'
import { pathKey } from './path'
import { type OrganizeState } from './types'

function bm(url: string): BookmarkNode {
  return { type: 'bookmark', id: url, title: url, index: 0, url, domain: '' }
}

function ana(url: string, category: string, subcategory = ''): StoredAnalysis {
  return {
    url,
    status: 'ok',
    summary: '',
    category,
    subcategory,
    tags: [],
    importance: 0,
    reason: '',
    analyzedAt: 0,
    model: 'test',
  }
}

function state(partial: Partial<OrganizeState> = {}): OrganizeState {
  return { ...EMPTY_ORGANIZE, ...partial }
}

describe('buildPathTree', () => {
  it('nests purpose, category, and uncategorized with correct ordering + origin', () => {
    const work = bm('https://work.test')
    const game = bm('https://game.test')
    const loose = bm('https://loose.test')
    const original = { [work.url]: ['karrot', 'pay'] }
    const analysis = { [game.url]: ana(game.url, 'Games', 'Diablo4') }
    const st = state({ purposeRoots: ['karrot'] })

    const tree = buildPathTree([work, game, loose], original, analysis, st)

    // purpose first → category → Uncategorized last
    expect(tree.map((n) => n.segment)).toEqual(['karrot', 'Games', UNCATEGORIZED])

    const karrot = tree[0]
    expect(karrot.origin).toBe('purpose')
    expect(karrot.children.map((c) => c.segment)).toEqual(['pay'])
    expect(karrot.children[0].path).toEqual(['karrot', 'pay'])
    expect(karrot.children[0].bookmarks.map((b) => b.url)).toEqual([work.url])

    const games = tree[1]
    expect(games.origin).toBe('category')
    expect(games.children[0].segment).toBe('Diablo4')
    expect(games.children[0].bookmarks.map((b) => b.url)).toEqual([game.url])

    expect(tree[2].bookmarks.map((b) => b.url)).toEqual([loose.url])
  })

  it('seeds empty extra paths so created folders render', () => {
    const tree = buildPathTree([], {}, {}, state({ extraPaths: [['NewCat']] }))
    expect(tree.map((n) => n.segment)).toEqual(['NewCat'])
    expect(tree[0].bookmarks).toEqual([])
  })

  it('does not mutate inputs', () => {
    const b = bm('https://x.test')
    const original = { [b.url]: ['karrot'] }
    buildPathTree([b], original, {}, state({ purposeRoots: ['karrot'] }))
    expect(original).toEqual({ [b.url]: ['karrot'] })
  })
})

describe('createPath', () => {
  it('adds a new path and ignores duplicates / empties', () => {
    const a = createPath(EMPTY_ORGANIZE, ['Dev'])
    expect(a.extraPaths).toEqual([['Dev']])
    expect(createPath(a, ['Dev']).extraPaths).toEqual([['Dev']])
    expect(createPath(a, ['  '])).toBe(a)
  })
})

describe('moveBookmarks', () => {
  it('overrides urls to a single target path', () => {
    const next = moveBookmarks(EMPTY_ORGANIZE, ['u1', 'u2'], ['Games', 'Diablo4'])
    expect(next.overrides).toEqual({ u1: ['Games', 'Diablo4'], u2: ['Games', 'Diablo4'] })
  })
  it('is a no-op for empty target or empty urls', () => {
    expect(moveBookmarks(EMPTY_ORGANIZE, [], ['X'])).toBe(EMPTY_ORGANIZE)
    expect(moveBookmarks(EMPTY_ORGANIZE, ['u'], ['  '])).toBe(EMPTY_ORGANIZE)
  })
})

describe('renamePath', () => {
  it('rebases extra paths and applies affected placements (nested)', () => {
    const st = state({
      overrides: { u: ['6.Games', 'Diablo4'] },
      extraPaths: [['6.Games'], ['6.Games', 'Skyrim']],
    })
    const affected: Placement[] = [{ url: 'u', path: ['Games', 'Diablo4'] }]
    const next = renamePath(st, ['6.Games'], ['Games'], affected)
    expect(next.overrides.u).toEqual(['Games', 'Diablo4'])
    expect(next.extraPaths).toEqual([['Games'], ['Games', 'Skyrim']])
  })
  it('is a no-op when from equals to', () => {
    const st = state({ extraPaths: [['X']] })
    expect(renamePath(st, ['X'], ['X'], [])).toBe(st)
  })
})

describe('mergePaths', () => {
  it('rebases source extra paths into target and applies placements', () => {
    const st = state({ extraPaths: [['A'], ['B'], ['C']] })
    const affected: Placement[] = [
      { url: 'u1', path: ['C'] },
      { url: 'u2', path: ['C'] },
    ]
    const next = mergePaths(st, [['A'], ['B']], ['C'], affected)
    expect(next.overrides).toEqual({ u1: ['C'], u2: ['C'] })
    expect(next.extraPaths).toEqual([['C']])
  })
})

describe('deletePath', () => {
  it('removes the path subtree and reassigns members', () => {
    const st = state({ extraPaths: [['Games'], ['Games', 'Diablo4'], ['Keep']] })
    const affected: Placement[] = [{ url: 'u', path: [UNCATEGORIZED] }]
    const next = deletePath(st, ['Games'], affected)
    expect(next.extraPaths).toEqual([['Keep']])
    expect(next.overrides.u).toEqual([UNCATEGORIZED])
  })
})

describe('togglePurposeRoot', () => {
  it('adds then removes a segment', () => {
    const on = togglePurposeRoot(EMPTY_ORGANIZE, 'karrot')
    expect(on.purposeRoots).toEqual(['karrot'])
    const off = togglePurposeRoot(on, 'karrot')
    expect(off.purposeRoots).toEqual([])
  })
  it('ignores blank segments', () => {
    expect(togglePurposeRoot(EMPTY_ORGANIZE, '  ')).toBe(EMPTY_ORGANIZE)
  })
})

describe('pathKey re-use', () => {
  it('keeps moveBookmarks override stable across equal paths', () => {
    const a = moveBookmarks(EMPTY_ORGANIZE, ['u'], ['Games'])
    expect(pathKey(a.overrides.u)).toBe(pathKey(['Games']))
  })
})

describe('buildRootTree', () => {
  const rootsInfo = [
    { rootId: '1', title: 'Bar' },
    { rootId: '2', title: 'Other' },
  ]

  it('groups bookmarks by their effective root and nests categories', () => {
    const dev = bm('https://d')
    const game = bm('https://g')
    const forest = buildRootTree(
      [dev, game],
      rootsInfo,
      {},
      { 'https://d': 'Bar', 'https://g': 'Other' },
      { 'https://d': ana('https://d', 'Development'), 'https://g': ana('https://g', 'Games') },
      EMPTY_ORGANIZE,
    )
    expect(forest.map((r) => r.title)).toEqual(['Bar', 'Other'])
    expect(forest[0].bookmarkCount).toBe(1)
    expect(forest[0].children[0].segment).toBe('Development')
    expect(forest[1].children[0].segment).toBe('Games')
  })

  it('honors rootOverride to move a bookmark to another 大', () => {
    const b = bm('https://x')
    const st = state({ rootOverrides: { 'https://x': 'Other' }, overrides: { 'https://x': ['Misc'] } })
    const forest = buildRootTree([b], rootsInfo, { 'https://x': [] }, { 'https://x': 'Bar' }, {}, st)
    expect(forest[0].bookmarkCount).toBe(0)
    expect(forest[1].bookmarkCount).toBe(1)
    expect(forest[1].children[0].segment).toBe('Misc')
  })

  it('seeds empty extra paths under the first root only', () => {
    const st = state({ extraPaths: [['New']] })
    const forest = buildRootTree([], rootsInfo, {}, {}, {}, st)
    expect(forest[0].children.map((c) => c.segment)).toEqual(['New'])
    expect(forest[1].children).toEqual([])
  })
})

describe('moveBookmarksToRoot', () => {
  it('sets rootOverride and override together', () => {
    const next = moveBookmarksToRoot(EMPTY_ORGANIZE, ['u'], 'Other', ['Games'])
    expect(next.rootOverrides).toEqual({ u: 'Other' })
    expect(next.overrides).toEqual({ u: ['Games'] })
  })
  it('is a no-op without a root title', () => {
    expect(moveBookmarksToRoot(EMPTY_ORGANIZE, ['u'], '', ['Games'])).toBe(EMPTY_ORGANIZE)
  })
})

describe('moveSubtreeToRoot', () => {
  it('moves placements to a new root and rebases extra paths', () => {
    const st = state({ extraPaths: [['Games'], ['Games', 'Diablo4']] })
    const affected: RootPlacement[] = [{ url: 'u', path: ['Arcade', 'Diablo4'], rootTitle: 'Other' }]
    const next = moveSubtreeToRoot(st, ['Games'], 'Other', ['Arcade'], affected)
    expect(next.rootOverrides.u).toBe('Other')
    expect(next.overrides.u).toEqual(['Arcade', 'Diablo4'])
    expect(next.extraPaths).toEqual([['Arcade'], ['Arcade', 'Diablo4']])
  })
})
