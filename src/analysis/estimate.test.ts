import { describe, expect, it } from 'vitest'
import { RECATEGORIZE_SYSTEM_PROMPT } from '@/ai/prompts'
import { type AnalyzeInput, type RecategorizeInput } from '@/ai/types'
import { RECATEGORIZE_CHUNK_SIZE } from './chunk'
import { estimateRecategorize, estimateTokens, estimateUsage } from './estimate'

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

describe('estimateRecategorize', () => {
  const recInput: RecategorizeInput = { title: 'React', domain: 'react.dev' }

  it('counts the system prompt once per chunk', () => {
    const within = estimateRecategorize(Array(RECATEGORIZE_CHUNK_SIZE).fill(recInput))
    const overflow = estimateRecategorize(Array(RECATEGORIZE_CHUNK_SIZE + 1).fill(recInput))
    // Crossing into a 2nd chunk adds another full system prompt (plus one input).
    expect(overflow.inputTokens - within.inputTokens).toBeGreaterThan(
      estimateTokens(RECATEGORIZE_SYSTEM_PROMPT),
    )
  })

  it('scales output tokens with the number of bookmarks', () => {
    const result = estimateRecategorize([recInput, recInput, recInput])
    expect(result.bookmarks).toBe(3)
    expect(result.outputTokens).toBeGreaterThan(0)
    expect(result.totalTokens).toBe(result.inputTokens + result.outputTokens)
  })
})
