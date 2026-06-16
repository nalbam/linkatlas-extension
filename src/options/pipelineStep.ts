/**
 * Pure derivation of "where the user is in the pipeline" so the UI can guide the
 * next step instead of leaving the five stages as disconnected buttons. Kept free
 * of React/stores so it is trivially unit-testable.
 *
 * Pipeline: ① read → ② collect metadata → ③ analyze → ④ recategorize/organize →
 * ⑤ apply. Stages ②③ live in the Tree view, ④⑤ in the Organize view.
 */

export type PipelineStep = 'collect' | 'analyze' | 'organize' | 'done'
export type PipelineView = 'tree' | 'organize'

export interface PipelineInput {
  totalBookmarks: number
  /** Bookmarks with a successful metadata record. */
  metadataCount: number
  /** Bookmarks with an AI category (per-bookmark analysis or recategorize). */
  categorizedCount: number
  /** A previous apply is rolled-back-able. */
  hasSnapshot: boolean
}

export interface PipelineStatus {
  step: PipelineStep
  /** One-line "do this next" label. */
  nextLabel: string
  /** Which view the next action lives in. */
  view: PipelineView
  /** Soft warnings that don't block, e.g. analyzing without metadata. */
  blockers: string[]
}

export function derivePipelineStep(input: PipelineInput): PipelineStatus {
  const { totalBookmarks, metadataCount, categorizedCount, hasSnapshot } = input
  const uncollected = Math.max(0, totalBookmarks - metadataCount)
  const blockers: string[] = []

  if (totalBookmarks === 0) {
    return { step: 'collect', nextLabel: '북마크가 없습니다.', view: 'tree', blockers }
  }
  if (metadataCount === 0) {
    return {
      step: 'collect',
      nextLabel: '메타데이터 수집으로 시작하세요.',
      view: 'tree',
      blockers,
    }
  }
  if (categorizedCount === 0) {
    if (uncollected > 0) {
      blockers.push(`${uncollected.toLocaleString()}개는 메타데이터가 없어 분석 정확도가 낮습니다.`)
    }
    return {
      step: 'analyze',
      nextLabel: 'AI 분석으로 각 사이트를 파악하세요.',
      view: 'tree',
      blockers,
    }
  }
  if (uncollected > 0) {
    blockers.push(`${uncollected.toLocaleString()}개는 메타데이터가 없습니다.`)
  }
  if (hasSnapshot) {
    return {
      step: 'done',
      nextLabel: '적용 완료 — 필요하면 롤백할 수 있습니다.',
      view: 'organize',
      blockers,
    }
  }
  return {
    step: 'organize',
    nextLabel: 'Organize에서 AI 재정리·편집 후 Chrome에 적용하세요.',
    view: 'organize',
    blockers,
  }
}
