import { type BookmarkMetadata } from './types'

/**
 * Metadata cache backed by `chrome.storage.local`, keyed by `meta:<url>`. The
 * cache makes collection incremental: fresh, successful records are skipped on
 * subsequent runs, and results survive popup/worker teardown.
 */

const PREFIX = 'meta:'
export const METADATA_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const keyOf = (url: string) => PREFIX + url

/** Load every cached record, keyed by URL. */
export async function getAllCachedMetadata(): Promise<Record<string, BookmarkMetadata>> {
  const all = await chrome.storage.local.get(null)
  const out: Record<string, BookmarkMetadata> = {}
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PREFIX)) {
      const meta = value as BookmarkMetadata
      out[meta.url] = meta
    }
  }
  return out
}

export async function setManyCachedMetadata(items: readonly BookmarkMetadata[]): Promise<void> {
  if (items.length === 0) return
  const record: Record<string, BookmarkMetadata> = {}
  for (const meta of items) record[keyOf(meta.url)] = meta
  await chrome.storage.local.set(record)
}

/** A record is fresh enough to skip only when it succeeded and is within TTL. */
export function isFresh(
  meta: BookmarkMetadata | undefined,
  now: number,
  ttlMs: number = METADATA_TTL_MS,
): boolean {
  return meta !== undefined && meta.status === 'ok' && now - meta.fetchedAt < ttlMs
}
