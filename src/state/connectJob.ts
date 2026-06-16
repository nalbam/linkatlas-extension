/**
 * Shared Port-job client used by the metadata / analysis / apply stores. Owns the
 * boilerplate every streaming job repeated by hand: connect the Port, throttle a
 * result buffer, route progress/done/error to the store, and — crucially —
 * distinguish a clean terminal close from an abnormal disconnect (the worker /
 * Port dying mid-job) so the latter surfaces as an error instead of looking done.
 *
 * The store keeps ownership of its own job-state shape: connectJob never calls
 * `set`; it only invokes the supplied callbacks.
 */

/** Progress shape shared by the streaming metadata / analysis jobs. */
export interface JobState {
  running: boolean
  total: number
  done: number
  ok: number
  failed: number
}

export const IDLE_JOB: JobState = { running: false, total: 0, done: 0, ok: 0, failed: 0 }

const FLUSH_INTERVAL_MS = 200

/**
 * Why a connection closed:
 * - `terminal` — a `done`/`error`/`rolledback` message arrived, or a cancelled job's
 *   Port disconnected (already handled / user-intended).
 * - `abort`    — the Port disconnected with no terminal message and no cancel (worker
 *   died); the store surfaces this as an error rather than a silent stop.
 *
 * Cancel is a `cancelMessage` to the worker (not a disconnect), so the new
 * Port-detach-keeps-job-running semantics can tell a user cancel apart from a
 * page reload. The worker aborts and sends a terminal message, which closes here.
 */
export type CloseReason = 'terminal' | 'abort'

export interface ConnectJobParams<WMsg extends { type: string }> {
  portName: string
  /** Posted immediately on connect — the request, or `{ type: 'attach' }` to re-subscribe. */
  request: unknown
  /** Posted to the worker on cancel, before disconnecting. */
  cancelMessage?: unknown
  /** When set, `result`-type messages are buffered and flushed together (throttled). */
  buffer?: {
    isResult: (message: WMsg) => boolean
    flush: (batch: WMsg[]) => void
  }
  /** Handle a non-buffered message (progress / done / error / ...). */
  onMessage: (message: WMsg) => void
  /** True for messages that end the job (done / error / rolledback). */
  isTerminal: (message: WMsg) => boolean
  /** Called exactly once when the connection closes, with the reason. */
  onClose: (reason: CloseReason) => void
  /** Port factory (injectable for tests); defaults to `chrome.runtime.connect`. */
  connect?: (portName: string) => chrome.runtime.Port
}

export interface JobConnection {
  cancel: () => void
}

export function connectJob<WMsg extends { type: string }>(
  params: ConnectJobParams<WMsg>,
): JobConnection {
  const connect = params.connect ?? ((portName: string) => chrome.runtime.connect({ name: portName }))
  const port = connect(params.portName)
  let batch: WMsg[] = []
  let scheduled = false
  let terminal = false
  let cancelled = false
  let closed = false

  const flush = () => {
    scheduled = false
    if (batch.length === 0) return
    const pending = batch
    batch = []
    params.buffer?.flush(pending)
  }

  const close = (reason: CloseReason) => {
    if (closed) return
    closed = true
    flush()
    params.onClose(reason)
  }

  port.onMessage.addListener((message: WMsg) => {
    if (params.buffer?.isResult(message)) {
      batch.push(message)
      if (!scheduled) {
        scheduled = true
        setTimeout(flush, FLUSH_INTERVAL_MS)
      }
      return
    }
    flush() // drain buffered results before a progress/done snapshot.
    params.onMessage(message)
    if (params.isTerminal(message)) {
      terminal = true
      try {
        port.disconnect()
      } catch {
        // Port already gone.
      }
      close('terminal')
    }
  })

  port.onDisconnect.addListener(() => {
    if (terminal) return
    // A cancelled job's disconnect is expected (worker finished aborting); only an
    // un-cancelled, non-terminal disconnect means the worker died.
    close(cancelled ? 'terminal' : 'abort')
  })

  port.postMessage(params.request)

  return {
    cancel: () => {
      cancelled = true
      try {
        // Ask the worker to abort; it will send a terminal message that closes us.
        if (params.cancelMessage !== undefined) port.postMessage(params.cancelMessage)
      } catch {
        // Port already gone.
      }
    },
  }
}
