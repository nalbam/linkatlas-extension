/**
 * MV3 service worker entry.
 *
 * Owns long-running, teardown-surviving work over `chrome.runtime` Ports:
 * - metadata collection (fetch + parse + cache each page),
 * - AI analysis + collection recategorize (provider calls, cached),
 * - apply / rollback (the destructive Chrome mutation).
 *
 * Jobs are owned by a registry keyed by Port name, NOT by the Port itself: a
 * disconnect detaches the Port but keeps the job running, so a reloaded options
 * page can re-attach (`{type:'attach'}`) and resume streaming. A keepalive timer
 * pokes an extension API every 20s while any job runs, preventing the ~30s idle
 * teardown that would otherwise lose a long single call (e.g. recategorize).
 */

import { runAnalysisJob } from './analysisJob'
import { runApplyJob, runRollbackJob } from './applyJob'
import { runRecategorizeJob } from './recategorizeJob'
import {
  ANALYSIS_PORT,
  APPLY_PORT,
  METADATA_PORT,
  type AnalysisClientMessage,
  type ApplyClientMessage,
  type ClientMessage,
} from './messages'
import { runMetadataJob } from './metadataJob'
import { clearJobSession, setJobSession } from './jobSession'
import { createProvider } from '@/ai/providers'

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[LinkAtlas] installed:', details.reason)
})

type ProgressMessage = { type: 'progress'; total: number; done: number }

interface ActiveJob {
  controller: AbortController
  /** The currently subscribed Port, or null while no page is attached. */
  port: chrome.runtime.Port | null
  /** Last progress sent, replayed verbatim when a page re-attaches. */
  lastProgress: ProgressMessage | null
}

/** Active jobs keyed by Port name (one job per Port kind at a time). */
const jobs = new Map<string, ActiveJob>()

// --- Keepalive ---------------------------------------------------------------

const KEEPALIVE_ALARM = 'linkatlas-keepalive'
let keepaliveTimer: ReturnType<typeof setInterval> | null = null

/** A no-op extension API call resets the service worker's idle teardown timer. */
function pokeWorker(): void {
  void chrome.runtime.getPlatformInfo()
}

function startKeepalive(): void {
  if (keepaliveTimer === null) keepaliveTimer = setInterval(pokeWorker, 20_000)
  // Alarm is a backstop wake in case the interval is ever lost.
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 1 })
}

function stopKeepaliveIfIdle(): void {
  if (jobs.size > 0) return
  if (keepaliveTimer !== null) {
    clearInterval(keepaliveTimer)
    keepaliveTimer = null
  }
  void chrome.alarms.clear(KEEPALIVE_ALARM)
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM && jobs.size > 0) pokeWorker()
})

// --- Port routing ------------------------------------------------------------

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((message) => handleMessage(port, message as { type: string }))
  port.onDisconnect.addListener(() => {
    // Detach this Port from its job (if any) but keep the job running.
    const job = jobs.get(port.name)
    if (job && job.port === port) job.port = null
  })
})

function handleMessage(port: chrome.runtime.Port, message: { type: string }): void {
  const portName = port.name

  if (message.type === 'attach') {
    const job = jobs.get(portName)
    if (job) {
      job.port = port
      if (job.lastProgress) safePost(port, job.lastProgress)
    } else {
      // The worker was torn down and the job is gone — tell the page to stop waiting.
      void clearJobSession(portName)
      safePost(port, { type: 'error', message: '작업이 중단되었습니다. 캐시에서 복원합니다.' })
    }
    return
  }

  if (message.type === 'cancel') {
    jobs.get(portName)?.controller.abort()
    return
  }

  if (portName === METADATA_PORT) {
    const m = message as ClientMessage
    if (m.type === 'collect') {
      startJob(portName, port, (post, signal) => runMetadataJob(m.urls, post, signal))
    }
  } else if (portName === ANALYSIS_PORT) {
    const m = message as AnalysisClientMessage
    if (m.type === 'analyze') {
      startJob(portName, port, (post, signal) => {
        const provider = createProvider(m.provider, m.apiKey, { model: m.model })
        return runAnalysisJob(m.items, provider, m.model ?? '', post, signal)
      })
    } else if (m.type === 'recategorize') {
      startJob(portName, port, (post, signal) => {
        const provider = createProvider(m.provider, m.apiKey, { model: m.model })
        return runRecategorizeJob(m.inputs, m.urlByIndex, provider, m.model ?? '', m.targetCount, post, signal)
      })
    }
  } else if (portName === APPLY_PORT) {
    const m = message as ApplyClientMessage
    if (m.type === 'apply') {
      startJob(portName, port, (post, signal) => runApplyJob(m.assignments, post, signal))
    } else if (m.type === 'rollback') {
      startJob(portName, port, (post) => runRollbackJob(post))
    }
  }
}

/**
 * Start a job under `portName`, routing its `post` to whichever Port is currently
 * attached (so a re-attach after reload keeps streaming). `run` may throw
 * synchronously (e.g. `createProvider` for an unimplemented provider); that is
 * funnelled into an `error` message like any other failure.
 */
function startJob<WMsg extends { type: string }>(
  portName: string,
  port: chrome.runtime.Port,
  run: (post: (message: WMsg) => void, signal: AbortSignal) => Promise<void>,
): void {
  if (jobs.has(portName)) return // already running — ignore duplicate start.

  const controller = new AbortController()
  const job: ActiveJob = { controller, port, lastProgress: null }
  jobs.set(portName, job)
  startKeepalive()
  void setJobSession(portName, { running: true, total: 0, done: 0 })

  let lastSessionWrite = 0
  const post = (message: WMsg) => {
    if (message.type === 'progress') {
      const p = message as unknown as { total: number; done: number }
      job.lastProgress = { type: 'progress', total: p.total, done: p.done }
      const now = Date.now()
      if (now - lastSessionWrite >= 1000) {
        lastSessionWrite = now
        void setJobSession(portName, { running: true, total: p.total, done: p.done })
      }
    }
    if (job.port) safePost(job.port, message)
  }

  Promise.resolve()
    .then(() => run(post, controller.signal))
    .catch((error) => post({ type: 'error', message: (error as Error).message } as unknown as WMsg))
    .finally(() => {
      jobs.delete(portName)
      void clearJobSession(portName)
      stopKeepaliveIfIdle()
    })
}

function safePost(port: chrome.runtime.Port, message: unknown): void {
  try {
    port.postMessage(message)
  } catch {
    // Port already closed by the client — nothing to do.
  }
}

export {}
