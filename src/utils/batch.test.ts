import { describe, expect, it, vi } from 'vitest'
import { runBatch } from './batch'

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

describe('runBatch', () => {
  it('preserves input order in results', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await runBatch(items, async (n) => {
      await tick()
      return n * 10
    })
    expect(results).toEqual([10, 20, 30, 40, 50])
  })

  it('never exceeds the concurrency limit', async () => {
    let active = 0
    let peak = 0
    await runBatch(Array.from({ length: 12 }, (_, i) => i), async () => {
      active += 1
      peak = Math.max(peak, active)
      await tick()
      active -= 1
    }, { concurrency: 3 })
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('reports progress for every item', async () => {
    const onProgress = vi.fn()
    await runBatch([1, 2, 3], async (n) => n, { onProgress })
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenLastCalledWith({ total: 3, done: 3 })
  })

  it('stops scheduling new work once aborted', async () => {
    const controller = new AbortController()
    let processed = 0
    const promise = runBatch(Array.from({ length: 20 }, (_, i) => i), async () => {
      processed += 1
      await tick()
    }, { concurrency: 2, signal: controller.signal })
    controller.abort()
    await promise
    expect(processed).toBeLessThan(20)
  })

  it('keeps going when a worker throws', async () => {
    const results = await runBatch([1, 2, 3], async (n) => {
      if (n === 2) throw new Error('boom')
      return n
    })
    expect(results[0]).toBe(1)
    expect(results[1]).toBeUndefined()
    expect(results[2]).toBe(3)
  })
})
