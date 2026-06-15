import { create } from 'zustand'
import {
  ANALYSIS_PORT,
  type AnalysisClientMessage,
  type AnalysisWorkerMessage,
} from '@/background/messages'
import { getAllCachedAnalysis } from '@/analysis/cache'
import { type AnalyzeItem, type StoredAnalysis } from '@/analysis/types'
import { type ProviderId } from '@/ai/types'

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

interface AnalysisState {
  byUrl: Record<string, StoredAnalysis>
  job: JobState
  loadFromCache: () => Promise<void>
  startAnalysis: (args: StartArgs) => void
  cancel: () => void
}

const IDLE_JOB: JobState = { running: false, total: 0, done: 0, ok: 0, failed: 0 }
const FLUSH_INTERVAL_MS = 200

let activePort: chrome.runtime.Port | null = null

/**
 * Holds per-bookmark AI analysis (keyed by URL) and live job progress. Mirrors
 * the metadata store: the worker does the calls, this connects the Port, streams
 * results in, and throttles store writes for large jobs.
 */
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  byUrl: {},
  job: IDLE_JOB,

  loadFromCache: async () => {
    set({ byUrl: await getAllCachedAnalysis() })
  },

  startAnalysis: ({ provider, apiKey, model, items }) => {
    if (get().job.running || items.length === 0) return

    const port = chrome.runtime.connect({ name: ANALYSIS_PORT })
    activePort = port
    set({ job: { running: true, total: items.length, done: 0, ok: 0, failed: 0 } })

    let buffer: Record<string, StoredAnalysis> = {}
    let scheduled = false
    const flush = () => {
      scheduled = false
      if (Object.keys(buffer).length === 0) return
      const incoming = buffer
      buffer = {}
      set((state) => ({ byUrl: { ...state.byUrl, ...incoming } }))
    }

    port.onMessage.addListener((message: AnalysisWorkerMessage) => {
      switch (message.type) {
        case 'progress':
          set((state) => ({ job: { ...state.job, total: message.total, done: message.done } }))
          break
        case 'result':
          buffer[message.analysis.url] = message.analysis
          if (!scheduled) {
            scheduled = true
            setTimeout(flush, FLUSH_INTERVAL_MS)
          }
          break
        case 'done':
          flush()
          set((state) => ({
            job: { ...state.job, running: false, done: message.total, ok: message.ok, failed: message.failed },
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

    port.postMessage({ type: 'analyze', provider, apiKey, model, items } satisfies AnalysisClientMessage)
  },

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
}))
