import { describe, expect, it } from 'vitest'
import { type RecategorizeAssignment, type RecategorizeInput } from '@/ai/types'
import { chunkRecategorizeInputs, findMissingIndices, remapAssignments } from './chunk'

const mk = (n: number): RecategorizeInput[] =>
  Array.from({ length: n }, (_, i) => ({ title: `t${i}`, domain: `d${i}.com` }))

describe('chunkRecategorizeInputs', () => {
  it('returns [] for empty input', () => {
    expect(chunkRecategorizeInputs([], 10)).toEqual([])
  })

  it('splits into chunks with correct offsets and a short final chunk', () => {
    const chunks = chunkRecategorizeInputs(mk(25), 10)
    expect(chunks.map((c) => c.offset)).toEqual([0, 10, 20])
    expect(chunks.map((c) => c.inputs.length)).toEqual([10, 10, 5])
  })

  it('treats chunkSize <= 0 as a single chunk (kill-switch)', () => {
    const chunks = chunkRecategorizeInputs(mk(5), 0)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].offset).toBe(0)
    expect(chunks[0].inputs).toHaveLength(5)
  })
})

describe('remapAssignments', () => {
  it('maps local indices to global by offset', () => {
    const local: RecategorizeAssignment[] = [
      { index: 0, path: ['A'] },
      { index: 2, path: ['B'] },
    ]
    expect(remapAssignments(local, 10, 5)).toEqual([
      { index: 10, path: ['A'] },
      { index: 12, path: ['B'] },
    ])
  })

  it('drops out-of-range and duplicate local indices', () => {
    const local: RecategorizeAssignment[] = [
      { index: 0, path: ['A'] },
      { index: 5, path: ['X'] }, // >= chunkLen
      { index: -1, path: ['Y'] }, // negative
      { index: 0, path: ['Z'] }, // duplicate
    ]
    expect(remapAssignments(local, 0, 3)).toEqual([{ index: 0, path: ['A'] }])
  })
})

describe('findMissingIndices', () => {
  it('returns the global indices the model left unassigned', () => {
    expect(findMissingIndices([0, 2], 4)).toEqual([1, 3])
  })

  it('returns [] when every index is covered', () => {
    expect(findMissingIndices([2, 0, 1], 3)).toEqual([])
  })
})
