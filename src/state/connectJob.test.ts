import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectJob, type CloseReason, type ConnectJobParams } from './connectJob'

type WMsg =
  | { type: 'progress'; total: number; done: number }
  | { type: 'result'; value: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

interface FakePort {
  posted: unknown[]
  disconnected: boolean
  onMessage: { addListener: (fn: (m: WMsg) => void) => void }
  onDisconnect: { addListener: (fn: () => void) => void }
  postMessage: (m: unknown) => void
  disconnect: () => void
  emit: (m: WMsg) => void
  emitDisconnect: () => void
}

function makeFakePort(): FakePort {
  const messageListeners: ((m: WMsg) => void)[] = []
  const disconnectListeners: (() => void)[] = []
  const port: FakePort = {
    posted: [],
    disconnected: false,
    onMessage: { addListener: (fn) => void messageListeners.push(fn) },
    onDisconnect: { addListener: (fn) => void disconnectListeners.push(fn) },
    postMessage: (m) => void port.posted.push(m),
    // chrome fires onDisconnect on the *other* side; our close() is guarded so
    // calling listeners here too is harmless and lets us assert the path.
    disconnect: () => {
      port.disconnected = true
      disconnectListeners.forEach((fn) => fn())
    },
    emit: (m) => messageListeners.forEach((fn) => fn(m)),
    emitDisconnect: () => disconnectListeners.forEach((fn) => fn()),
  }
  return port
}

function setup(overrides: Partial<ConnectJobParams<WMsg>> = {}) {
  const port = makeFakePort()
  const closes: CloseReason[] = []
  const flushed: WMsg[][] = []
  const messages: WMsg[] = []
  const conn = connectJob<WMsg>({
    portName: 'test',
    request: { type: 'start' },
    cancelMessage: { type: 'cancel' },
    connect: () => port as unknown as chrome.runtime.Port,
    buffer: {
      isResult: (m) => m.type === 'result',
      flush: (batch) => void flushed.push(batch),
    },
    onMessage: (m) => void messages.push(m),
    isTerminal: (m) => m.type === 'done' || m.type === 'error',
    onClose: (reason) => void closes.push(reason),
    ...overrides,
  })
  return { port, conn, closes, flushed, messages }
}

describe('connectJob', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('posts the request on connect', () => {
    const { port } = setup()
    expect(port.posted[0]).toEqual({ type: 'start' })
  })

  it('forwards progress without buffering or closing', () => {
    const { port, messages, closes } = setup()
    port.emit({ type: 'progress', total: 10, done: 3 })
    expect(messages).toEqual([{ type: 'progress', total: 10, done: 3 }])
    expect(closes).toEqual([])
  })

  it('buffers result messages and flushes them after the throttle window', () => {
    const { port, flushed, messages } = setup()
    port.emit({ type: 'result', value: 'a' })
    port.emit({ type: 'result', value: 'b' })
    expect(flushed).toEqual([]) // not yet
    vi.advanceTimersByTime(200)
    expect(flushed).toEqual([[{ type: 'result', value: 'a' }, { type: 'result', value: 'b' }]])
    expect(messages).toEqual([]) // results never go through onMessage
  })

  it('drains buffered results before a following non-result message', () => {
    const { port, flushed } = setup()
    port.emit({ type: 'result', value: 'a' })
    port.emit({ type: 'progress', total: 1, done: 1 }) // forces a synchronous flush
    expect(flushed).toEqual([[{ type: 'result', value: 'a' }]])
  })

  it('closes as terminal and disconnects on done', () => {
    const { port, messages, closes } = setup()
    port.emit({ type: 'done' })
    expect(messages).toEqual([{ type: 'done' }])
    expect(port.disconnected).toBe(true)
    expect(closes).toEqual(['terminal'])
  })

  it('closes as terminal on error', () => {
    const { port, closes } = setup()
    port.emit({ type: 'error', message: 'boom' })
    expect(closes).toEqual(['terminal'])
  })

  it('closes as abort when the port disconnects with no terminal message', () => {
    const { port, closes } = setup()
    port.emitDisconnect()
    expect(closes).toEqual(['abort'])
  })

  it('posts the cancel message without disconnecting, then closes on the worker terminal', () => {
    const { port, conn, closes } = setup()
    conn.cancel()
    expect(port.posted).toContainEqual({ type: 'cancel' })
    expect(port.disconnected).toBe(false) // wait for the worker's terminal message
    expect(closes).toEqual([])
    port.emit({ type: 'done' }) // worker aborts and reports done
    expect(closes).toEqual(['terminal'])
  })

  it("treats a cancelled job's disconnect as terminal, not abort", () => {
    const { port, conn, closes } = setup()
    conn.cancel()
    port.emitDisconnect() // worker tears down without a terminal message
    expect(closes).toEqual(['terminal'])
  })

  it('closes exactly once even if disconnect follows a terminal message', () => {
    const { port, closes } = setup()
    port.emit({ type: 'done' }) // disconnect() inside already fired listeners
    port.emitDisconnect() // a second, late disconnect
    expect(closes).toEqual(['terminal'])
  })
})
