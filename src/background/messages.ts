import { type AnalyzeItem, type StoredAnalysis } from '@/analysis/types'
import { type ProviderId, type RecategorizeInput } from '@/ai/types'
import { type ApplyAssignment, type ApplySummary } from '@/apply/types'
import { type BookmarkMetadata } from '@/metadata/types'

/**
 * Typed contracts for the background jobs, run over long-lived `chrome.runtime`
 * Ports. A client connects, sends a request, and receives streamed
 * `progress` / `result` messages until `done`.
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

export const ANALYSIS_PORT = 'linkatlas-analysis'

export type AnalysisClientMessage =
  | { type: 'analyze'; provider: ProviderId; apiKey: string; model?: string; items: AnalyzeItem[] }
  | {
      type: 'recategorize'
      provider: ProviderId
      apiKey: string
      model?: string
      inputs: RecategorizeInput[]
      urlByIndex: string[]
      targetCount?: number
    }
  | { type: 'cancel' }

export type AnalysisWorkerMessage =
  | { type: 'progress'; total: number; done: number }
  | { type: 'result'; analysis: StoredAnalysis }
  | { type: 'done'; total: number; ok: number; failed: number }
  | { type: 'error'; message: string }

export const APPLY_PORT = 'linkatlas-apply'

export type ApplyClientMessage =
  | { type: 'apply'; assignments: ApplyAssignment[] }
  | { type: 'rollback' }
  | { type: 'cancel' }

export type ApplyWorkerMessage =
  | { type: 'progress'; total: number; done: number }
  | { type: 'done'; summary: ApplySummary }
  | { type: 'rolledback'; restored: number }
  | { type: 'error'; message: string }
