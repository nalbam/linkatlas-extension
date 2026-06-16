import { describe, expect, it } from 'vitest'
import { derivePipelineStep, type PipelineInput } from './pipelineStep'

const base: PipelineInput = {
  totalBookmarks: 10,
  metadataCount: 0,
  categorizedCount: 0,
  hasSnapshot: false,
}

describe('derivePipelineStep', () => {
  it('empty collection → collect (tree)', () => {
    const s = derivePipelineStep({ ...base, totalBookmarks: 0 })
    expect(s.step).toBe('collect')
    expect(s.view).toBe('tree')
  })

  it('no metadata yet → collect', () => {
    expect(derivePipelineStep(base).step).toBe('collect')
  })

  it('metadata but nothing categorized → analyze', () => {
    const s = derivePipelineStep({ ...base, metadataCount: 10 })
    expect(s.step).toBe('analyze')
    expect(s.view).toBe('tree')
  })

  it('warns when analyzing with partial metadata coverage', () => {
    const s = derivePipelineStep({ ...base, metadataCount: 6 })
    expect(s.step).toBe('analyze')
    expect(s.blockers[0]).toContain('4')
  })

  it('categorized, no apply yet → organize (organize view)', () => {
    const s = derivePipelineStep({ ...base, metadataCount: 10, categorizedCount: 10 })
    expect(s.step).toBe('organize')
    expect(s.view).toBe('organize')
  })

  it('categorized and already applied → done', () => {
    const s = derivePipelineStep({
      ...base,
      metadataCount: 10,
      categorizedCount: 10,
      hasSnapshot: true,
    })
    expect(s.step).toBe('done')
  })

  it('carries a metadata-gap blocker into the organize step', () => {
    const s = derivePipelineStep({ ...base, metadataCount: 7, categorizedCount: 10 })
    expect(s.step).toBe('organize')
    expect(s.blockers[0]).toContain('3')
  })
})
