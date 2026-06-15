import { create } from 'zustand'
import {
  METADATA_PORT,
  type ClientMessage,
  type WorkerMessage,
} from '@/background/messages'
import { getAllCachedMetadata } from '@/metadata/cache'
import { type BookmarkMetadata } from '@/metadata/types'

interface JobState {
  running: boolean
  total: number
  done: number
  ok: number
  failed: number
}

interface MetadataState {
  byUrl: Record<string, BookmarkMetadata>
  job: JobState
  loadFromCache: () => Promise<void>
  startCollection: (urls: string[]) => void
  cancel: () => void
}

const IDLE_JOB: JobState = { running: false, total: 0, done: 0, ok: 0, failed: 0 }
const FLUSH_INTERVAL_MS = 200

let activePort: chrome.runtime.Port | null = null

/**
 * Holds collected metadata (keyed by URL) and the live job progress. The actual
 * fetching happens in the service worker; this store connects the Port, streams
 * results in, and throttles store writes so a multi-thousand-item job doesn't
 * spread `byUrl` on every single result.
 */
export const useMetadataStore = create<MetadataState>((set, get) => ({
  byUrl: {},
  job: IDLE_JOB,

  loadFromCache: async () => {
    set({ byUrl: await getAllCachedMetadata() })
  },

  startCollection: (urls) => {
    if (get().job.running || urls.length === 0) return

    const port = chrome.runtime.connect({ name: METADATA_PORT })
    activePort = port
    set({ job: { running: true, total: urls.length, done: 0, ok: 0, failed: 0 } })

    // Buffer incoming results and flush at most every FLUSH_INTERVAL_MS.
    let buffer: Record<string, BookmarkMetadata> = {}
    let scheduled = false
    const flush = () => {
      scheduled = false
      if (Object.keys(buffer).length === 0) return
      const incoming = buffer
      buffer = {}
      set((state) => ({ byUrl: { ...state.byUrl, ...incoming } }))
    }

    port.onMessage.addListener((message: WorkerMessage) => {
      switch (message.type) {
        case 'progress':
          set((state) => ({ job: { ...state.job, total: message.total, done: message.done } }))
          break
        case 'result':
          buffer[message.meta.url] = message.meta
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

    port.postMessage({ type: 'collect', urls } satisfies ClientMessage)
  },

  cancel: () => {
    if (activePort) {
      try {
        activePort.postMessage({ type: 'cancel' } satisfies ClientMessage)
        activePort.disconnect()
      } catch {
        // Port already gone.
      }
      activePort = null
    }
    set((state) => ({ job: { ...state.job, running: false } }))
  },
}))
