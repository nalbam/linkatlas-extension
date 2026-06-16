import { describe, expect, it } from 'vitest'
import {
  buildRecategorizeUserPrompt,
  buildUserPrompt,
  normalizeAnalysis,
  parseAnalysisContent,
  parseRecategorizeContent,
} from './prompts'

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

describe('buildRecategorizeUserPrompt', () => {
  it('numbers each bookmark and includes the target count when given', () => {
    const prompt = buildRecategorizeUserPrompt(
      [
        { title: 'React', domain: 'react.dev' },
        { title: 'AWS', domain: 'aws.amazon.com', hint: 'cloud console' },
      ],
      8,
    )
    expect(prompt).toContain('Aim for about 8 top-level categories')
    expect(prompt).toContain('0: React — react.dev')
    expect(prompt).toContain('1: AWS — aws.amazon.com — cloud console')
  })

  it('lists existing categories to reuse (running taxonomy)', () => {
    const prompt = buildRecategorizeUserPrompt([{ title: 'X', domain: 'x.com' }], 8, [
      'Development',
      'Development > Frontend',
      'Games',
    ])
    expect(prompt).toContain('REUSE')
    expect(prompt).toContain('Development > Frontend')
    expect(prompt).toContain('Games')
  })

  it('omits the existing-categories line when none are given', () => {
    const prompt = buildRecategorizeUserPrompt([{ title: 'X', domain: 'x.com' }], 8)
    expect(prompt).not.toContain('REUSE')
  })

  it('prefers the analysis summary over the hint and appends tags', () => {
    const prompt = buildRecategorizeUserPrompt([
      { title: 'React', domain: 'react.dev', hint: 'raw meta', summary: 'UI library docs', tags: ['React', 'UI'] },
    ])
    expect(prompt).toContain('0: React — react.dev — UI library docs — tags: React, UI')
    expect(prompt).not.toContain('raw meta')
  })
})

describe('parseRecategorizeContent', () => {
  it('parses assignments and caps path depth at 2', () => {
    const json = JSON.stringify({
      assignments: [
        { index: 0, path: ['Development'] },
        { index: 1, path: ['Games', 'Minecraft', 'Mods'] },
      ],
    })
    expect(parseRecategorizeContent(json)).toEqual([
      { index: 0, path: ['Development'] },
      { index: 1, path: ['Games', 'Minecraft'] },
    ])
  })

  it('drops invalid indices and blank segments', () => {
    const json = JSON.stringify({
      assignments: [
        { index: -1, path: ['X'] },
        { index: 2, path: ['  ', 'Real'] },
      ],
    })
    expect(parseRecategorizeContent(json)).toEqual([{ index: 2, path: ['Real'] }])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseRecategorizeContent('nope')).toThrow(/not valid JSON/)
  })
})
