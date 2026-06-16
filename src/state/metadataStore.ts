import { create } from 'zustand'
import {
  METADATA_PORT,
  type ClientMessage,
  type WorkerMessage,
} from '@/background/messages'
import { getJobSession } from '@/background/jobSession'
import { getAllCachedMetadata } from '@/metadata/cache'
import { type BookmarkMetadata } from '@/metadata/types'
import { connectJob, IDLE_JOB, type JobConnection, type JobState } from './connectJob'

interface MetadataState {
  byUrl: Record<string, BookmarkMetadata>
  job: JobState
  error: string | null
  loadFromCache: () => Promise<void>
  startCollection: (urls: string[]) => void
  attach: () => Promise<void>
  cancel: () => void
}

let connection: JobConnection | null = null

/**
 * Holds collected metadata (keyed by URL) and the live job progress. The actual
 * fetching happens in the service worker; this store connects the Port (via the
 * shared {@link connectJob}), streams results in, and throttles store writes so a
 * multi-thousand-item job doesn't spread `byUrl` on every single result.
 */
export const useMetadataStore = create<MetadataState>((set, get) => {
  const connect = (request: ClientMessage, initial: JobState) => {
    set({ job: initial, error: null })
    connection = connectJob<WorkerMessage>({
      portName: METADATA_PORT,
      request,
      cancelMessage: { type: 'cancel' } satisfies ClientMessage,
      buffer: {
        isResult: (message) => message.type === 'result',
        flush: (batch) =>
          set((state) => {
            const byUrl = { ...state.byUrl }
            for (const message of batch) if (message.type === 'result') byUrl[message.meta.url] = message.meta
            return { byUrl }
          }),
      },
      onMessage: (message) => {
        if (message.type === 'progress') {
          set((state) => ({ job: { ...state.job, total: message.total, done: message.done } }))
        } else if (message.type === 'done') {
          set((state) => ({
            job: { ...state.job, running: false, done: message.total, ok: message.ok, failed: message.failed },
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
      set({ byUrl: await getAllCachedMetadata() })
    },

    startCollection: (urls) => {
      if (get().job.running || urls.length === 0) return
      connect(
        { type: 'collect', urls },
        { running: true, total: urls.length, done: 0, ok: 0, failed: 0 },
      )
    },

    attach: async () => {
      if (get().job.running) return
      const session = await getJobSession(METADATA_PORT)
      if (!session?.running) return
      connect({ type: 'attach' }, { running: true, total: session.total, done: session.done, ok: 0, failed: 0 })
    },

    cancel: () => {
      connection?.cancel()
      set((state) => ({ job: { ...state.job, running: false } }))
    },
  }
})
