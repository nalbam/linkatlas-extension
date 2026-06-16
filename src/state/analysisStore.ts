import { create } from 'zustand'
import {
  ANALYSIS_PORT,
  type AnalysisClientMessage,
  type AnalysisWorkerMessage,
} from '@/background/messages'
import { getAllCachedAnalysis } from '@/analysis/cache'
import { type AnalyzeItem, type StoredAnalysis } from '@/analysis/types'
import { type ProviderId, type RecategorizeInput } from '@/ai/types'

interface JobState {
  running: boolean
  total: number
  done: number
  ok: number
  failed: number
}

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
  loadFromCache: () => Promise<void>
  startAnalysis: (args: StartArgs) => void
  startRecategorize: (args: StartRecategorizeArgs) => void
  cancel: () => void
}

const IDLE_JOB: JobState = { running: false, total: 0, done: 0, ok: 0, failed: 0 }
const FLUSH_INTERVAL_MS = 200

let activePort: chrome.runtime.Port | null = null

/**
 * Holds per-bookmark AI analysis (keyed by URL) and live job progress. The
 * worker does the provider calls; this connects the Port, streams results in,
 * and throttles store writes for large jobs. Both `startAnalysis` (per-bookmark)
 * and `startRecategorize` (whole-collection) share the same Port + merge path —
 * recategorize just updates category/subcategory of the same `byUrl` records.
 */
export const useAnalysisStore = create<AnalysisState>((set, get) => {
  const runJob = (total: number, message: AnalysisClientMessage) => {
    if (get().job.running || total === 0) return

    const port = chrome.runtime.connect({ name: ANALYSIS_PORT })
    activePort = port
    set({ job: { running: true, total, done: 0, ok: 0, failed: 0 } })

    let buffer: Record<string, StoredAnalysis> = {}
    let scheduled = false
    const flush = () => {
      scheduled = false
      if (Object.keys(buffer).length === 0) return
      const incoming = buffer
      buffer = {}
      set((state) => ({ byUrl: { ...state.byUrl, ...incoming } }))
    }

    port.onMessage.addListener((workerMessage: AnalysisWorkerMessage) => {
      switch (workerMessage.type) {
        case 'progress':
          set((state) => ({ job: { ...state.job, total: workerMessage.total, done: workerMessage.done } }))
          break
        case 'result':
          buffer[workerMessage.analysis.url] = workerMessage.analysis
          if (!scheduled) {
            scheduled = true
            setTimeout(flush, FLUSH_INTERVAL_MS)
          }
          break
        case 'done':
          flush()
          set((state) => ({
            job: { ...state.job, running: false, done: workerMessage.total, ok: workerMessage.ok, failed: workerMessage.failed },
          }))
          port.disconnect()
          activePort = null
          break
        case 'error':
          flush()
          set((state) => ({ job: { ...state.job, running: false } }))
          port.disconnect()
          activePort = null
          break
      }
    })

    port.onDisconnect.addListener(() => {
      activePort = null
      set((state) => (state.job.running ? { job: { ...state.job, running: false } } : {}))
    })

    port.postMessage(message)
  }

  return {
    byUrl: {},
    job: IDLE_JOB,

    loadFromCache: async () => {
      set({ byUrl: await getAllCachedAnalysis() })
    },

    startAnalysis: ({ provider, apiKey, model, items }) =>
      runJob(items.length, { type: 'analyze', provider, apiKey, model, items }),

    startRecategorize: ({ provider, apiKey, model, inputs, urlByIndex, targetCount }) =>
      runJob(inputs.length, {
        type: 'recategorize',
        provider,
        apiKey,
        model,
        inputs,
        urlByIndex,
        targetCount,
      }),

    cancel: () => {
      if (activePort) {
        try {
          activePort.postMessage({ type: 'cancel' } satisfies AnalysisClientMessage)
          activePort.disconnect()
        } catch {
          // Port already gone.
        }
        activePort = null
      }
      set((state) => ({ job: { ...state.job, running: false } }))
    },
  }
})
