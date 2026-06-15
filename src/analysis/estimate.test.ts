import { describe, expect, it } from 'vitest'
import { type AnalyzeInput } from '@/ai/types'
import { estimateTokens, estimateUsage } from './estimate'

const input: AnalyzeInput = {
  title: 'React',
  url: 'https://react.dev',
  domain: 'react.dev',
}

describe('estimateTokens', () => {
  it('uses a chars/4 ceiling', () => {
    expect(estimateTokens('12345')).toBe(2)
    expect(estimateTokens('')).toBe(0)
  })
})

describe('estimateUsage', () => {
  it('returns zero usage for an empty scope', () => {
    expect(estimateUsage([])).toEqual({
      bookmarks: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      approxUsd: 0,
    })
  })

  it('scales output tokens and cost with the number of bookmarks', () => {
    const one = estimateUsage([input])
    const two = estimateUsage([input, input])
    expect(two.bookmarks).toBe(2)
    expect(two.outputTokens).toBe(one.outputTokens * 2)
    expect(two.inputTokens).toBe(one.inputTokens * 2)
    expect(two.approxUsd).toBeGreaterThan(one.approxUsd)
    expect(one.totalTokens).toBe(one.inputTokens + one.outputTokens)
  })
})
