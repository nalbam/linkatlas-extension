import {
  RECATEGORIZE_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  buildRecategorizeUserPrompt,
  buildUserPrompt,
} from '@/ai/prompts'
import { type AnalyzeInput, type RecategorizeInput } from '@/ai/types'

/**
 * Rough pre-send usage estimate so the user sees a token/cost figure before any
 * data leaves the browser (required by the privacy gate). Uses a chars/4 token
 * heuristic — deliberately approximate; the token count is the primary signal
 * and the dollar figure is labelled "approx" in the UI.
 */

const CHARS_PER_TOKEN = 4
const OUTPUT_TOKENS_PER_ITEM = 180

// Approximate USD per 1K tokens for the default model. Update as provider
// pricing changes — this is the single source for the cost estimate.
const APPROX_USD_PER_1K_INPUT = 0.00015
const APPROX_USD_PER_1K_OUTPUT = 0.0006

export interface UsageEstimate {
  bookmarks: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  approxUsd: number
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function estimateUsage(inputs: readonly AnalyzeInput[]): UsageEstimate {
  const systemTokens = estimateTokens(SYSTEM_PROMPT)
  let inputTokens = 0
  for (const input of inputs) {
    inputTokens += systemTokens + estimateTokens(buildUserPrompt(input))
  }
  const outputTokens = inputs.length * OUTPUT_TOKENS_PER_ITEM
  const approxUsd =
    (inputTokens / 1000) * APPROX_USD_PER_1K_INPUT +
    (outputTokens / 1000) * APPROX_USD_PER_1K_OUTPUT
  return {
    bookmarks: inputs.length,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    approxUsd,
  }
}

// Recategorization is a single call: one prompt for the whole list + a short
// assignment per bookmark.
const OUTPUT_TOKENS_PER_ASSIGNMENT = 12

export function estimateRecategorize(inputs: readonly RecategorizeInput[]): UsageEstimate {
  const prompt = `${RECATEGORIZE_SYSTEM_PROMPT}\n${buildRecategorizeUserPrompt(inputs)}`
  const inputTokens = estimateTokens(prompt)
  const outputTokens = inputs.length * OUTPUT_TOKENS_PER_ASSIGNMENT
  const approxUsd =
    (inputTokens / 1000) * APPROX_USD_PER_1K_INPUT +
    (outputTokens / 1000) * APPROX_USD_PER_1K_OUTPUT
  return {
    bookmarks: inputs.length,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    approxUsd,
  }
}
