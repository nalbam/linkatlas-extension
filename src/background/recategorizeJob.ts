import { getAllCachedAnalysis, setManyCachedAnalysis } from '@/analysis/cache'
import { applyRecategorize } from '@/analysis/recategorize'
import { type AIProvider, type RecategorizeInput } from '@/ai/types'
import { type AnalysisWorkerMessage } from './messages'

/**
 * Recategorize the whole collection in a single provider call, then fold the
 * assignments into the analysis cache (updating only category/subcategory,
 * preserving existing summary/importance) and stream each updated record back
 * over the analysis Port — reusing the analysis store's result-merge path.
 */
export async function runRecategorizeJob(
  inputs: readonly RecategorizeInput[],
  urlByIndex: readonly string[],
  provider: AIProvider,
  model: string,
  targetCount: number | undefined,
  post: (message: AnalysisWorkerMessage) => void,
  signal: AbortSignal,
): Promise<void> {
  try {
    post({ type: 'progress', total: inputs.length, done: 0 })
    const assignments = await provider.recategorize([...inputs], { targetCount })
    if (signal.aborted) return

    const existing = await getAllCachedAnalysis()
    const results = applyRecategorize(assignments, urlByIndex, existing, model, Date.now())
    await setManyCachedAnalysis(results)

    for (const analysis of results) post({ type: 'result', analysis })
    post({ type: 'progress', total: inputs.length, done: inputs.length })
    post({ type: 'done', total: inputs.length, ok: results.length, failed: inputs.length - results.length })
  } catch (error) {
    post({ type: 'error', message: (error as Error).message })
  }
}
