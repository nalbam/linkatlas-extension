import { type RecategorizeAssignment, type RecategorizeInput } from '@/ai/types'

/**
 * Split a whole-collection recategorize request into bounded chunks so each goes
 * to the model as its own call. One giant call hits output-token limits and
 * truncates (some inputs come back unassigned); chunking keeps every call's
 * output small and lets a single chunk fail without losing the rest.
 *
 * Each chunk is sent with LOCAL 0-based indices (the model only sees that chunk);
 * `offset` maps a chunk-local index back to its global position. A `chunkSize` of
 * 0 or less means "no chunking" (one chunk) — a kill-switch back to the old
 * single-call behaviour.
 */

/** Inputs per recategorize call — small enough that the model's output never truncates. */
export const RECATEGORIZE_CHUNK_SIZE = 100

export interface RecategorizeChunk {
  inputs: RecategorizeInput[]
  /** Global index of this chunk's first input. */
  offset: number
}

export function chunkRecategorizeInputs(
  inputs: readonly RecategorizeInput[],
  chunkSize: number,
): RecategorizeChunk[] {
  if (inputs.length === 0) return []
  if (chunkSize <= 0) return [{ inputs: [...inputs], offset: 0 }]
  const chunks: RecategorizeChunk[] = []
  for (let offset = 0; offset < inputs.length; offset += chunkSize) {
    chunks.push({ inputs: inputs.slice(offset, offset + chunkSize), offset })
  }
  return chunks
}

/**
 * Map a chunk's local assignments back to global indices, dropping any the model
 * shouldn't have produced: out-of-range local indices and duplicates.
 */
export function remapAssignments(
  local: readonly RecategorizeAssignment[],
  offset: number,
  chunkLen: number,
): RecategorizeAssignment[] {
  const out: RecategorizeAssignment[] = []
  const seen = new Set<number>()
  for (const assignment of local) {
    if (assignment.index < 0 || assignment.index >= chunkLen) continue
    if (seen.has(assignment.index)) continue
    seen.add(assignment.index)
    out.push({ index: offset + assignment.index, path: assignment.path })
  }
  return out
}

/** Global indices in `[0, total)` not present in `covered` — the inputs the model left unassigned. */
export function findMissingIndices(covered: readonly number[], total: number): number[] {
  const present = new Set(covered)
  const missing: number[] = []
  for (let index = 0; index < total; index += 1) {
    if (!present.has(index)) missing.push(index)
  }
  return missing
}
