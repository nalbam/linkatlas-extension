import { getAllCachedAnalysis, setManyCachedAnalysis } from '@/analysis/cache'
import {
  RECATEGORIZE_CHUNK_SIZE,
  chunkRecategorizeInputs,
  findMissingIndices,
  remapAssignments,
} from '@/analysis/chunk'
import { applyRecategorize } from '@/analysis/recategorize'
import { type StoredAnalysis } from '@/analysis/types'
import { type AIProvider, type RecategorizeInput } from '@/ai/types'
import { type AnalysisWorkerMessage } from './messages'

/**
 * Recategorize the whole collection in bounded chunks (one provider call each),
 * folding every chunk's assignments into the analysis cache as it lands and
 * streaming the updated records back over the analysis Port. Chunking keeps each
 * call's output small (no truncation), lets one chunk fail without losing the
 * rest, and surfaces inputs the model left unassigned as `failed`.
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
  const total = inputs.length
  const chunks = chunkRecategorizeInputs(inputs, RECATEGORIZE_CHUNK_SIZE)
  const covered: number[] = []
  const pending: StoredAnalysis[] = []
  const errors: string[] = []

  // Running taxonomy: labels chosen by earlier chunks, fed to later ones so the
  // model reuses them instead of inventing parallel categories per chunk.
  const known: string[] = []
  const knownSet = new Set<string>()
  const remember = (path: readonly string[]) => {
    const label = path.join(' > ')
    if (label && !knownSet.has(label)) {
      knownSet.add(label)
      known.push(label)
    }
  }

  const flush = async () => {
    if (pending.length === 0) return
    const batch = pending.splice(0, pending.length)
    await setManyCachedAnalysis(batch)
  }

  try {
    post({ type: 'progress', total, done: 0 })
    const existing = await getAllCachedAnalysis()
    let done = 0

    for (const chunk of chunks) {
      if (signal.aborted) break
      try {
        const local = await provider.recategorize([...chunk.inputs], {
          targetCount,
          signal,
          existingCategories: [...known],
        })
        const assignments = remapAssignments(local, chunk.offset, chunk.inputs.length)
        const results = applyRecategorize(assignments, urlByIndex, existing, model, Date.now())
        for (const assignment of assignments) {
          covered.push(assignment.index)
          remember(assignment.path)
        }
        for (const analysis of results) {
          pending.push(analysis)
          post({ type: 'result', analysis })
        }
        await flush()
      } catch (error) {
        if (signal.aborted) break
        const from = chunk.offset + 1
        const to = chunk.offset + chunk.inputs.length
        errors.push(`${from}-${to}: ${(error as Error).message}`)
        // This chunk failed — leave its inputs unassigned (counted as failed) and continue.
      }
      done += chunk.inputs.length
      post({ type: 'progress', total, done })
    }

    await flush()
    const failed = findMissingIndices(covered, total).length
    post({ type: 'done', total, ok: covered.length, failed, errors: errors.length ? errors : undefined })
  } catch (error) {
    await flush()
    post({ type: 'error', message: (error as Error).message })
  }
}
