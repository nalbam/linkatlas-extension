import { type StoredAnalysis } from './types'

/**
 * Analysis cache backed by `chrome.storage.local`, keyed by `analysis:<url>`.
 * Successful analyses are skipped on re-runs (incremental); errors are retried.
 */

const PREFIX = 'analysis:'
const keyOf = (url: string) => PREFIX + url

export async function getAllCachedAnalysis(): Promise<Record<string, StoredAnalysis>> {
  const all = await chrome.storage.local.get(null)
  const out: Record<string, StoredAnalysis> = {}
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PREFIX)) {
      const analysis = value as StoredAnalysis
      out[analysis.url] = analysis
    }
  }
  return out
}

export async function setManyCachedAnalysis(items: readonly StoredAnalysis[]): Promise<void> {
  if (items.length === 0) return
  const record: Record<string, StoredAnalysis> = {}
  for (const analysis of items) record[keyOf(analysis.url)] = analysis
  await chrome.storage.local.set(record)
}

/** Remove every cached analysis record (used by the organize reset). */
export async function clearAllCachedAnalysis(): Promise<void> {
  const all = await chrome.storage.local.get(null)
  const keys = Object.keys(all).filter((key) => key.startsWith(PREFIX))
  if (keys.length > 0) await chrome.storage.local.remove(keys)
}

/** A successful analysis is "fresh" — re-runs skip it. */
export function hasFreshAnalysis(analysis: StoredAnalysis | undefined): boolean {
  return analysis !== undefined && analysis.status === 'ok'
}
