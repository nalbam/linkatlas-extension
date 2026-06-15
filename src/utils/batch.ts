export interface BatchProgress {
  total: number
  done: number
}

export interface RunBatchOptions<T, R> {
  /** Max workers running at once (rate limiting). */
  concurrency?: number
  /** Abort scheduling of further items (in-flight items still settle). */
  signal?: AbortSignal
  onResult?: (result: R, item: T, index: number) => void
  onProgress?: (progress: BatchProgress) => void
}

/**
 * Run `worker` over `items` with a bounded number of concurrent executions.
 * Results preserve input order. A worker that throws does not reject the batch —
 * its slot is left `undefined` and processing continues. This is the rate
 * limiter for metadata fetching.
 */
export async function runBatch<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: RunBatchOptions<T, R> = {},
): Promise<R[]> {
  const { concurrency = 5, signal, onResult, onProgress } = options
  const total = items.length
  const results = new Array<R>(total)
  let nextIndex = 0
  let done = 0

  const runLane = async (): Promise<void> => {
    while (true) {
      if (signal?.aborted) return
      const index = nextIndex++
      if (index >= total) return
      try {
        const result = await worker(items[index], index)
        results[index] = result
        onResult?.(result, items[index], index)
      } catch {
        // Leave the slot empty; a well-behaved worker reports failure in-band.
      } finally {
        done += 1
        onProgress?.({ total, done })
      }
    }
  }

  const lanes = Math.max(1, Math.min(concurrency, total))
  await Promise.all(Array.from({ length: lanes }, runLane))
  return results
}
