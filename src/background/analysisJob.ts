import { setManyCachedAnalysis } from '@/analysis/cache'
import { type AnalyzeItem, type StoredAnalysis } from '@/analysis/types'
import { normalizeAnalysis } from '@/ai/prompts'
import { type AIProvider } from '@/ai/types'
import { runBatch } from '@/utils/batch'
import { type AnalysisWorkerMessage } from './messages'

// Conservative concurrency: AI calls are rate-limited and cost money.
const CONCURRENCY = 3
const FLUSH_EVERY = 5

/**
 * Analyze each item with the chosen provider (rate-limited), stream every
 * result back, and flush to the cache periodically. Per-item failures are
 * captured as `status: 'error'` records — the job never throws on one bad item.
 */
export async function runAnalysisJob(
  items: readonly AnalyzeItem[],
  provider: AIProvider,
  model: string,
  post: (message: AnalysisWorkerMessage) => void,
  signal: AbortSignal,
): Promise<void> {
  let ok = 0
  let failed = 0
  const pending: StoredAnalysis[] = []

  const flush = async () => {
    if (pending.length === 0) return
    const batch = pending.splice(0, pending.length)
    await setManyCachedAnalysis(batch)
  }

  const analyzeOne = async (item: AnalyzeItem): Promise<StoredAnalysis> => {
    try {
      const result = await provider.analyzeBookmark(item.input, { signal })
      return { ...result, url: item.url, status: 'ok', analyzedAt: Date.now(), model, summarized: true }
    } catch (error) {
      // On cancel, don't persist an error record — leave the item unanalyzed.
      if (signal.aborted) throw error
      return {
        ...normalizeAnalysis({}),
        url: item.url,
        status: 'error',
        error: (error as Error).message,
        analyzedAt: Date.now(),
        model,
      }
    }
  }

  try {
    await runBatch(items, analyzeOne, {
      concurrency: CONCURRENCY,
      signal,
      onResult: (analysis) => {
        if (analysis.status === 'ok') ok += 1
        else failed += 1
        pending.push(analysis)
        post({ type: 'result', analysis })
        if (pending.length >= FLUSH_EVERY) void flush()
      },
      onProgress: ({ total, done }) => post({ type: 'progress', total, done }),
    })
    await flush()
    post({ type: 'done', total: items.length, ok, failed })
  } catch (error) {
    await flush()
    post({ type: 'error', message: (error as Error).message })
  }
}
