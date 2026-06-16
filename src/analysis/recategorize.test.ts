import { describe, expect, it } from 'vitest'
import { type BookmarkNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { applyRecategorize, buildRecategorizeInputs } from './recategorize'
import { type StoredAnalysis } from './types'

function bm(url: string, title = 't', domain = 'd'): BookmarkNode {
  return { type: 'bookmark', id: url, title, index: 0, url, domain }
}

function ana(url: string, category: string, subcategory = '', summary = ''): StoredAnalysis {
  return {
    url,
    status: 'ok',
    summary,
    category,
    subcategory,
    tags: ['t1'],
    importance: 5,
    reason: 'r',
    analyzedAt: 1,
    model: 'old',
  }
}

function meta(url: string, description: string): BookmarkMetadata {
  return { url, keywords: [], status: 'ok', fetchedAt: 0, description }
}

describe('buildRecategorizeInputs', () => {
  it('excludes purpose-group bookmarks and keeps the index→url mapping', () => {
    const work = bm('https://w', 'Work', 'karrot.com')
    const dev = bm('https://d', 'Dev', 'github.com')
    const req = buildRecategorizeInputs(
      [work, dev],
      { 'https://w': ['karrot', 'pay'], 'https://d': ['6.Devlop'] },
      { 'https://w': 'Other', 'https://d': 'Other' },
      ['karrot'],
      [],
      {},
    )
    expect(req.urlByIndex).toEqual(['https://d'])
    expect(req.inputs).toEqual([{ title: 'Dev', domain: 'github.com', hint: undefined }])
  })

  it('excludes bookmarks whose 大 root is in excludeRootTitles (bookmark bar = manual)', () => {
    const barItem = bm('https://bar', 'Bar item', 'bar.com')
    const otherItem = bm('https://other', 'Other item', 'o.com')
    const req = buildRecategorizeInputs(
      [barItem, otherItem],
      {},
      { 'https://bar': 'Bookmarks Bar', 'https://other': 'Other Bookmarks' },
      [],
      ['Bookmarks Bar'],
      {},
    )
    expect(req.urlByIndex).toEqual(['https://other'])
  })

  it('adds a trimmed metadata hint capped at 100 chars', () => {
    const b = bm('https://x', 'X', 'x.com')
    const req = buildRecategorizeInputs([b], {}, {}, [], [], {
      'https://x': meta('https://x', '  ' + 'a'.repeat(200)),
    })
    expect(req.inputs[0].hint?.length).toBe(100)
  })
})

describe('applyRecategorize', () => {
  it('updates only category/subcategory, preserving summary/importance/tags', () => {
    const url = 'https://d'
    const [result] = applyRecategorize(
      [{ index: 0, path: ['Development', 'Frontend'] }],
      [url],
      { [url]: ana(url, 'Old', 'Sub', 'keep me') },
      'new',
      123,
    )
    expect(result).toMatchObject({
      url,
      category: 'Development',
      subcategory: 'Frontend',
      summary: 'keep me',
      importance: 5,
      tags: ['t1'],
      status: 'ok',
      model: 'new',
      analyzedAt: 123,
    })
  })

  it('creates a fresh ok record when none exists', () => {
    const [r] = applyRecategorize([{ index: 0, path: ['News'] }], ['https://n'], {}, 'm', 1)
    expect(r).toMatchObject({ url: 'https://n', category: 'News', subcategory: '', status: 'ok', summary: '' })
  })

  it('skips assignments whose index is out of range', () => {
    expect(applyRecategorize([{ index: 5, path: ['X'] }], ['https://a'], {}, 'm', 1)).toEqual([])
  })
})
