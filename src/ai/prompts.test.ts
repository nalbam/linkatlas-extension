import { describe, expect, it } from 'vitest'
import { buildUserPrompt, normalizeAnalysis, parseAnalysisContent } from './prompts'

describe('normalizeAnalysis', () => {
  it('clamps importance into 0–10 and rounds', () => {
    expect(normalizeAnalysis({ importance: 42 }).importance).toBe(10)
    expect(normalizeAnalysis({ importance: -3 }).importance).toBe(0)
    expect(normalizeAnalysis({ importance: 4.6 }).importance).toBe(5)
    expect(normalizeAnalysis({ importance: 'oops' }).importance).toBe(0)
  })

  it('dedupes and trims tags, dropping empties and leading #', () => {
    expect(normalizeAnalysis({ tags: ['React', 'react', '  ', '#AWS', 'AWS'] }).tags).toEqual([
      'React',
      'AWS',
    ])
  })

  it('falls back to Uncategorized when category missing', () => {
    expect(normalizeAnalysis({}).category).toBe('Uncategorized')
  })

  it('ignores non-object input', () => {
    expect(normalizeAnalysis(null)).toEqual({
      summary: '',
      category: 'Uncategorized',
      subcategory: '',
      tags: [],
      importance: 0,
      reason: '',
    })
  })
})

describe('buildUserPrompt', () => {
  it('includes optional metadata only when present', () => {
    const prompt = buildUserPrompt({
      title: 'React',
      url: 'https://react.dev',
      domain: 'react.dev',
      keywords: ['ui', 'library'],
    })
    expect(prompt).toContain('Title: React')
    expect(prompt).toContain('Keywords: ui, library')
    expect(prompt).not.toContain('Description:')
  })
})

describe('parseAnalysisContent', () => {
  it('throws a clear error on invalid JSON', () => {
    expect(() => parseAnalysisContent('not json')).toThrow(/not valid JSON/)
  })
})
