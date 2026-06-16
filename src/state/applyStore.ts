import { create } from 'zustand'
import { getSnapshot } from '@/apply/snapshot'
import { type ApplyAssignment, type ApplySummary } from '@/apply/types'
import {
  APPLY_PORT,
  type ApplyClientMessage,
  type ApplyWorkerMessage,
} from '@/background/messages'
import { getJobSession } from '@/background/jobSession'
import { connectJob } from './connectJob'

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
  attach: () => Promise<void>
  refreshSnapshotFlag: () => Promise<void>
}

const IDLE: JobState = { running: false, mode: null, total: 0, done: 0 }

/**
 * Drives the destructive apply / rollback jobs in the service worker over a Port
 * (via the shared {@link connectJob}) and tracks whether a rollback snapshot is
 * available. No result stream — only progress + a terminal summary. Apply is not
 * user-cancellable, so the connection handle is not retained.
 */
export const useApplyStore = create<ApplyState>((set, get) => {
  const connect = (request: ApplyClientMessage, mode: Exclude<Mode, null>, initialTotal: number) => {
    set({ job: { running: true, mode, total: initialTotal, done: 0 }, error: null })
    connectJob<ApplyWorkerMessage>({
      portName: APPLY_PORT,
      request,
      onMessage: (message) => {
        if (message.type === 'progress') {
          set((state) => ({ job: { ...state.job, total: message.total, done: message.done } }))
        } else if (message.type === 'done') {
          set({
            job: IDLE,
            lastSummary: message.summary,
            hasSnapshot: message.summary.created + message.summary.moved > 0,
          })
        } else if (message.type === 'rolledback') {
          set({ job: IDLE, lastSummary: null, hasSnapshot: false })
        } else if (message.type === 'error') {
          set({ job: IDLE, error: message.message })
        }
      },
      isTerminal: (message) =>
        message.type === 'done' || message.type === 'rolledback' || message.type === 'error',
      onClose: (reason) => {
        if (reason === 'abort') {
          set((state) =>
            state.job.running ? { job: IDLE, error: '연결이 끊겨 작업이 중단되었습니다.' } : {},
          )
        }
      },
    })
  }

  return {
    job: IDLE,
    lastSummary: null,
    hasSnapshot: false,
    error: null,

    startApply: ({ assignments }) => {
      if (get().job.running) return
      const total = assignments.reduce((n, a) => n + a.bookmarkIds.length, 0)
      connect({ type: 'apply', assignments }, 'apply', total)
    },
    rollback: () => {
      if (get().job.running) return
      connect({ type: 'rollback' }, 'rollback', 0)
    },
    attach: async () => {
      if (get().job.running) return
      const session = await getJobSession(APPLY_PORT)
      if (!session?.running) return
      connect({ type: 'attach' }, 'apply', session.total)
    },
    refreshSnapshotFlag: async () => {
      set({ hasSnapshot: (await getSnapshot()) !== null })
    },
  }
})
