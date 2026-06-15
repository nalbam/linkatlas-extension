import { type BookmarkMetadata } from '@/metadata/types'

/**
 * Typed contract for the metadata-collection job, run over a long-lived
 * `chrome.runtime` Port. The options page connects, sends a `collect` request,
 * and receives streamed `progress` / `result` messages until `done`.
 */

export const METADATA_PORT = 'linkatlas-metadata'

export type ClientMessage =
  | { type: 'collect'; urls: string[] }
  | { type: 'cancel' }

export type WorkerMessage =
  | { type: 'progress'; total: number; done: number }
  | { type: 'result'; meta: BookmarkMetadata }
  | { type: 'done'; total: number; ok: number; failed: number }
  | { type: 'error'; message: string }
