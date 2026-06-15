import { type AnalyzeInput, type BookmarkAnalysis } from '@/ai/types'

/**
 * An analysis result persisted per bookmark (keyed by URL). Extends the raw
 * model output with provenance + status so the UI can show success/failure and
 * the cache can reason about freshness.
 */
export interface StoredAnalysis extends BookmarkAnalysis {
  url: string
  status: 'ok' | 'error'
  error?: string
  analyzedAt: number
  model: string
}

/** One unit of work sent to the background analysis job. */
export interface AnalyzeItem {
  url: string
  input: AnalyzeInput
}
