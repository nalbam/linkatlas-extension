/**
 * Per-bookmark metadata collected from the live page. Stored separately from the
 * Chrome bookmark tree (keyed by URL) and merged into rows at render time.
 */

export type MetadataStatus = 'ok' | 'error' | 'timeout'

export interface BookmarkMetadata {
  url: string
  /** Final URL after redirects, when different from `url`. */
  finalUrl?: string
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  keywords: string[]
  faviconUrl?: string
  status: MetadataStatus
  /** Human-readable failure reason when status is not 'ok'. */
  error?: string
  /** Epoch ms when this record was produced (drives cache staleness). */
  fetchedAt: number
}

/** The subset extracted purely from an HTML string (no fetch concerns). */
export interface ParsedMetadata {
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  keywords: string[]
  faviconUrl?: string
}
