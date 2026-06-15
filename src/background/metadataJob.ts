import { setManyCachedMetadata } from '@/metadata/cache'
import { fetchBookmarkMetadata } from '@/metadata/fetchMetadata'
import { type BookmarkMetadata } from '@/metadata/types'
import { runBatch } from '@/utils/batch'
import { type WorkerMessage } from './messages'

const CONCURRENCY = 5
const TIMEOUT_MS = 8000
const FLUSH_EVERY = 10

/**
 * Run a metadata-collection job: fetch each URL (rate-limited), stream every
 * result back through `post`, and flush results to the cache periodically so
 * partial progress survives a worker shutdown.
 */
export async function runMetadataJob(
  urls: readonly string[],
  post: (message: WorkerMessage) => void,
  signal: AbortSignal,
): Promise<void> {
  let ok = 0
  let failed = 0
  const pending: BookmarkMetadata[] = []

  const flush = async () => {
    if (pending.length === 0) return
    const batch = pending.splice(0, pending.length)
    await setManyCachedMetadata(batch)
  }

  try {
    await runBatch(urls, (url) => fetchBookmarkMetadata(url, { timeoutMs: TIMEOUT_MS }), {
      concurrency: CONCURRENCY,
      signal,
      onResult: (meta) => {
        if (meta.status === 'ok') ok += 1
        else failed += 1
        pending.push(meta)
        post({ type: 'result', meta })
        if (pending.length >= FLUSH_EVERY) void flush()
      },
      onProgress: ({ total, done }) => post({ type: 'progress', total, done }),
    })
    await flush()
    post({ type: 'done', total: urls.length, ok, failed })
  } catch (error) {
    await flush()
    post({ type: 'error', message: (error as Error).message })
  }
}
