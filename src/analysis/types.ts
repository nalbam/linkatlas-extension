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
  /**
   * Whether per-bookmark analysis (③) filled summary/tags/importance. `false` marks
   * a record produced by collection recategorize (④) only — it carries a
   * category but no real per-bookmark signal, so it stays eligible for analysis.
   * `undefined` on legacy records means "treat as analyzed" (no regression).
   */
  summarized?: boolean
}

/** One unit of work sent to the background analysis job. */
export interface AnalyzeItem {
  url: string
  input: AnalyzeInput
}
