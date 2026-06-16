import { describe, expect, it } from 'vitest'
import { type StoredAnalysis } from '@/analysis/types'
import { type BookmarkNode } from '@/bookmarks/types'
import {
  UNCATEGORIZED,
  effectivePath,
  hasPrefix,
  parsePathKey,
  pathKey,
  rebasePrefix,
} from './path'

function bookmark(url: string): BookmarkNode {
  return { type: 'bookmark', id: url, title: url, index: 0, url, domain: '' }
}

function analysis(url: string, category: string, subcategory = ''): StoredAnalysis {
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

describe('pathKey / parsePathKey', () => {
  it('round-trips a path', () => {
    const p = ['karrot', 'pay']
    expect(parsePathKey(pathKey(p))).toEqual(p)
  })
  it('maps the empty path to the empty key and back', () => {
    expect(pathKey([])).toBe('')
    expect(parsePathKey('')).toEqual([])
  })
  it('keeps segments containing spaces intact (separator cannot collide)', () => {
    expect(parsePathKey(pathKey(['6.Games', 'Cyberpunk 2077']))).toEqual(['6.Games', 'Cyberpunk 2077'])
  })
})

describe('hasPrefix', () => {
  it('matches a proper prefix', () => {
    expect(hasPrefix(['a', 'b', 'c'], ['a', 'b'])).toBe(true)
  })
  it('rejects a divergent or longer prefix', () => {
    expect(hasPrefix(['a', 'b'], ['a', 'x'])).toBe(false)
    expect(hasPrefix(['a'], ['a', 'b'])).toBe(false)
  })
  it('treats the empty prefix as always matching', () => {
    expect(hasPrefix(['a'], [])).toBe(true)
  })
})

describe('rebasePrefix', () => {
  it('rebases a nested path when the prefix matches', () => {
    expect(rebasePrefix(['6.Games', 'Diablo4'], ['6.Games'], ['Games'])).toEqual(['Games', 'Diablo4'])
  })
  it('rebases the prefix node itself', () => {
    expect(rebasePrefix(['6.Games'], ['6.Games'], ['Games'])).toEqual(['Games'])
  })
  it('returns the path unchanged when the prefix does not match', () => {
    expect(rebasePrefix(['Design'], ['6.Games'], ['Games'])).toEqual(['Design'])
  })
})

describe('effectivePath', () => {
  const b = bookmark('https://x.test')

  it('1. honors a manual override above everything', () => {
    const r = effectivePath(
      b,
      { [b.url]: ['orig'] },
      { [b.url]: analysis(b.url, 'AI') },
      { overrides: { [b.url]: ['Manual', 'Deep'] }, purposeRoots: [] },
    )
    expect(r).toEqual({ path: ['Manual', 'Deep'], origin: 'category' })
  })

  it('tags an override under a purpose root as purpose', () => {
    const r = effectivePath(b, {}, {}, {
      overrides: { [b.url]: ['karrot', 'pay'] },
      purposeRoots: ['karrot'],
    })
    expect(r).toEqual({ path: ['karrot', 'pay'], origin: 'purpose' })
  })

  it('2. preserves a purpose folder path and ignores AI', () => {
    const r = effectivePath(
      b,
      { [b.url]: ['karrot', 'pay'] },
      { [b.url]: analysis(b.url, 'Finance') },
      { overrides: {}, purposeRoots: ['karrot'] },
    )
    expect(r).toEqual({ path: ['karrot', 'pay'], origin: 'purpose' })
  })

  it('3. uses AI [category, subcategory] for a non-purpose folder', () => {
    const r = effectivePath(
      b,
      { [b.url]: ['6.Games'] },
      { [b.url]: analysis(b.url, 'Games', 'Diablo4') },
      { overrides: {}, purposeRoots: [] },
    )
    expect(r).toEqual({ path: ['Games', 'Diablo4'], origin: 'category' })
  })

  it('3. omits the subcategory segment when AI gives none', () => {
    const r = effectivePath(b, {}, { [b.url]: analysis(b.url, 'Dev') }, {
      overrides: {},
      purposeRoots: [],
    })
    expect(r).toEqual({ path: ['Dev'], origin: 'category' })
  })

  it('4. falls back to the original folder path before AI runs', () => {
    const r = effectivePath(b, { [b.url]: ['6.Games', 'Skyrim'] }, {}, {
      overrides: {},
      purposeRoots: [],
    })
    expect(r).toEqual({ path: ['6.Games', 'Skyrim'], origin: 'category' })
  })

  it('5. falls back to Uncategorized for a loose, unanalyzed bookmark', () => {
    const r = effectivePath(b, {}, {}, { overrides: {}, purposeRoots: [] })
    expect(r).toEqual({ path: [UNCATEGORIZED], origin: 'category' })
  })

  it('ignores a failed analysis', () => {
    const failed: StoredAnalysis = { ...analysis(b.url, 'Dev'), status: 'error' }
    const r = effectivePath(b, {}, { [b.url]: failed }, { overrides: {}, purposeRoots: [] })
    expect(r).toEqual({ path: [UNCATEGORIZED], origin: 'category' })
  })
})
