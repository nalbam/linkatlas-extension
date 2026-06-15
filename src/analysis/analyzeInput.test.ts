import { describe, expect, it } from 'vitest'
import { type BookmarkNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { buildAnalyzeInput } from './analyzeInput'

const bookmark: BookmarkNode = {
  type: 'bookmark',
  id: 'b1',
  title: 'React',
  index: 0,
  url: 'https://react.dev',
  domain: 'react.dev',
}

function meta(partial: Partial<BookmarkMetadata>): BookmarkMetadata {
  return { url: bookmark.url, status: 'ok', keywords: [], fetchedAt: 0, ...partial }
}

describe('buildAnalyzeInput', () => {
  it('uses bookmark fields and enriches with metadata', () => {
    const input = buildAnalyzeInput(
      bookmark,
      meta({ description: 'The library for web UIs', keywords: ['react', 'ui'] }),
    )
    expect(input).toEqual({
      title: 'React',
      url: 'https://react.dev',
      domain: 'react.dev',
      description: 'The library for web UIs',
      keywords: ['react', 'ui'],
    })
  })

  it('falls back to OG description and omits empty keywords', () => {
    const input = buildAnalyzeInput(bookmark, meta({ ogDescription: 'OG desc', keywords: [] }))
    expect(input.description).toBe('OG desc')
    expect(input.keywords).toBeUndefined()
  })

  it('works with no metadata', () => {
    const input = buildAnalyzeInput(bookmark)
    expect(input.description).toBeUndefined()
    expect(input.keywords).toBeUndefined()
    expect(input.title).toBe('React')
  })

  it('falls back to metadata title when the bookmark has none', () => {
    const untitled: BookmarkNode = { ...bookmark, title: '' }
    expect(buildAnalyzeInput(untitled, meta({ title: 'Meta Title' })).title).toBe('Meta Title')
  })
})
