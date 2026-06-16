import { create } from 'zustand'
import {
  ANALYSIS_PORT,
  type AnalysisClientMessage,
  type AnalysisWorkerMessage,
} from '@/background/messages'
import { getJobSession } from '@/background/jobSession'
import { clearAllCachedAnalysis, getAllCachedAnalysis } from '@/analysis/cache'
import { type AnalyzeItem, type StoredAnalysis } from '@/analysis/types'
import { type ProviderId, type RecategorizeInput } from '@/ai/types'
import { connectJob, IDLE_JOB, type JobConnection, type JobState } from './connectJob'

interface StartArgs {
  provider: ProviderId
  apiKey: string
  model?: string
  items: AnalyzeItem[]
}

interface StartRecategorizeArgs {
  provider: ProviderId
  apiKey: string
  model?: string
  inputs: RecategorizeInput[]
  urlByIndex: string[]
  targetCount?: number
}

interface AnalysisState {
  byUrl: Record<string, StoredAnalysis>
  job: JobState
  error: string | null
  loadFromCache: () => Promise<void>
  startAnalysis: (args: StartArgs) => void
  startRecategorize: (args: StartRecategorizeArgs) => void
  attach: () => Promise<void>
  clearAll: () => void
  cancel: () => void
}

let connection: JobConnection | null = null

/**
 * Holds per-bookmark AI analysis (keyed by URL) and live job progress. The
 * worker does the provider calls; this connects the Port (via the shared
 * {@link connectJob}), streams results in, and throttles store writes for large
 * jobs. Both `startAnalysis` (per-bookmark) and `startRecategorize`
 * (whole-collection) share the same Port + merge path — recategorize just updates
 * category/subcategory of the same `byUrl` records.
 */
export const useAnalysisStore = create<AnalysisState>((set, get) => {
  const connect = (request: AnalysisClientMessage, initial: JobState) => {
    set({ job: initial, error: null })
    connection = connectJob<AnalysisWorkerMessage>({
      portName: ANALYSIS_PORT,
      request,
      cancelMessage: { type: 'cancel' } satisfies AnalysisClientMessage,
      buffer: {
        isResult: (message) => message.type === 'result',
        flush: (batch) =>
          set((state) => {
            const byUrl = { ...state.byUrl }
            for (const message of batch) if (message.type === 'result') byUrl[message.analysis.url] = message.analysis
            return { byUrl }
          }),
      },
      onMessage: (message) => {
        if (message.type === 'progress') {
          set((state) => ({ job: { ...state.job, total: message.total, done: message.done } }))
        } else if (message.type === 'done') {
          set((state) => ({
            job: { ...state.job, running: false, done: message.total, ok: message.ok, failed: message.failed },
            error:
              message.ok === 0 && message.total > 0
                ? '0 results — the model returned no usable assignments.'
                : null,
          }))
        } else if (message.type === 'error') {
          set((state) => ({ job: { ...state.job, running: false }, error: message.message }))
        }
      },
      isTerminal: (message) => message.type === 'done' || message.type === 'error',
      onClose: (reason) => {
        connection = null
        if (reason === 'abort') {
          set((state) =>
            state.job.running
              ? { job: { ...state.job, running: false }, error: '연결이 끊겨 작업이 중단되었습니다.' }
              : {},
          )
        }
        // Reconcile any results missed while detached (and on clean done).
        void get().loadFromCache()
      },
    })
  }

  return {
    byUrl: {},
    job: IDLE_JOB,
    error: null,

    loadFromCache: async () => {
      set({ byUrl: await getAllCachedAnalysis() })
    },

    startAnalysis: ({ provider, apiKey, model, items }) => {
      if (get().job.running || items.length === 0) return
      connect(
        { type: 'analyze', provider, apiKey, model, items },
        { running: true, total: items.length, done: 0, ok: 0, failed: 0 },
      )
    },

    startRecategorize: ({ provider, apiKey, model, inputs, urlByIndex, targetCount }) => {
      if (get().job.running || inputs.length === 0) return
      connect(
        { type: 'recategorize', provider, apiKey, model, inputs, urlByIndex, targetCount },
        { running: true, total: inputs.length, done: 0, ok: 0, failed: 0 },
      )
    },

    attach: async () => {
      if (get().job.running) return
      const session = await getJobSession(ANALYSIS_PORT)
      if (!session?.running) return
      connect({ type: 'attach' }, { running: true, total: session.total, done: session.done, ok: 0, failed: 0 })
    },

    clearAll: () => {
      set({ byUrl: {} })
      void clearAllCachedAnalysis()
    },

    cancel: () => {
      connection?.cancel()
      set((state) => ({ job: { ...state.job, running: false } }))
    },
  }
})
