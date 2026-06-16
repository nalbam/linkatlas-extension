import { create } from 'zustand'
import { getSnapshot } from '@/apply/snapshot'
import { type ApplyAssignment, type ApplySummary } from '@/apply/types'
import {
  APPLY_PORT,
  type ApplyClientMessage,
  type ApplyWorkerMessage,
} from '@/background/messages'

type Mode = 'apply' | 'rollback' | null

interface JobState {
  running: boolean
  mode: Mode
  total: number
  done: number
}

interface ApplyState {
  job: JobState
  lastSummary: ApplySummary | null
  hasSnapshot: boolean
  error: string | null
  startApply: (args: { assignments: ApplyAssignment[] }) => void
  rollback: () => void
  refreshSnapshotFlag: () => Promise<void>
}

const IDLE: JobState = { running: false, mode: null, total: 0, done: 0 }

/**
 * Drives the destructive apply / rollback jobs in the service worker over a Port
 * and tracks whether a rollback snapshot is available.
 */
export const useApplyStore = create<ApplyState>((set, get) => {
  const run = (message: ApplyClientMessage, mode: Exclude<Mode, null>) => {
    if (get().job.running) return
    const port = chrome.runtime.connect({ name: APPLY_PORT })
    set({ job: { running: true, mode, total: 0, done: 0 }, error: null })

    port.onMessage.addListener((workerMessage: ApplyWorkerMessage) => {
      switch (workerMessage.type) {
        case 'progress':
          set((state) => ({ job: { ...state.job, total: workerMessage.total, done: workerMessage.done } }))
          break
        case 'done':
          set({
            job: IDLE,
            lastSummary: workerMessage.summary,
            hasSnapshot: workerMessage.summary.created + workerMessage.summary.moved > 0,
          })
          port.disconnect()
          break
        case 'rolledback':
          set({ job: IDLE, lastSummary: null, hasSnapshot: false })
          port.disconnect()
          break
        case 'error':
          set({ job: IDLE, error: workerMessage.message })
          port.disconnect()
          break
      }
    })

    port.onDisconnect.addListener(() => {
      set((state) => (state.job.running ? { job: IDLE } : {}))
    })

    port.postMessage(message)
  }

  return {
    job: IDLE,
    lastSummary: null,
    hasSnapshot: false,
    error: null,

    startApply: ({ assignments }) => run({ type: 'apply', assignments }, 'apply'),
    rollback: () => run({ type: 'rollback' }, 'rollback'),
    refreshSnapshotFlag: async () => {
      set({ hasSnapshot: (await getSnapshot()) !== null })
    },
  }
})
