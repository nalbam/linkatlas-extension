/**
 * AI provider abstraction.
 *
 * Every provider (OpenAI, Gemini, Claude, …) implements the same `AIProvider`
 * contract so the rest of the app never depends on a concrete vendor. New
 * providers are pluggable: implement the interface and register it in
 * `ai/providers/index.ts`.
 */

export type ProviderId = 'openai' | 'gemini' | 'claude'

/** Structured analysis returned for a single bookmark. */
export interface BookmarkAnalysis {
  summary: string
  /** AI-inferred top-level category (never hardcoded). */
  category: string
  subcategory: string
  tags: string[]
  /** Relative importance, 0–10. */
  importance: number
  /** Short rationale for the category/importance choice. */
  reason: string
}

/** Minimal signal we send to the model for one bookmark. */
export interface AnalyzeInput {
  title: string
  url: string
  domain: string
  description?: string
  keywords?: string[]
}

/** One bookmark's signal for collection-wide recategorization (no url — index-keyed). */
export interface RecategorizeInput {
  title: string
  domain: string
  hint?: string
}

/** The model's category assignment for one input, by its index in the request. */
export interface RecategorizeAssignment {
  index: number
  /** `[中]` or `[中, 小]` — capped at 2 segments. */
  path: string[]
}

export interface AIProvider {
  readonly id: ProviderId
  /** Display name for settings UI. */
  readonly label: string
  analyzeBookmark(input: AnalyzeInput): Promise<BookmarkAnalysis>
  /** Group a whole collection into a small, consistent set of categories in one call. */
  recategorize(
    inputs: RecategorizeInput[],
    options: { targetCount?: number },
  ): Promise<RecategorizeAssignment[]>
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  claude: 'Claude',
}
