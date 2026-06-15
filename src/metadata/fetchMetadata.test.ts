import { describe, expect, it, vi } from 'vitest'
import { fetchBookmarkMetadata } from './fetchMetadata'

function htmlResponse(body: string, { url = 'https://site.com/', status = 200 } = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null) },
    text: async () => body,
  } as unknown as Response
}

describe('fetchBookmarkMetadata', () => {
  it('parses metadata and captures the redirected final URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      htmlResponse('<title>Hi</title><meta name="description" content="d">', {
        url: 'https://site.com/final',
      }),
    )
    const meta = await fetchBookmarkMetadata('https://site.com/start', { fetchImpl })
    expect(meta.status).toBe('ok')
    expect(meta.title).toBe('Hi')
    expect(meta.description).toBe('d')
    expect(meta.finalUrl).toBe('https://site.com/final')
  })

  it('rejects invalid URLs without calling fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const meta = await fetchBookmarkMetadata('not a url', { fetchImpl })
    expect(meta.status).toBe('error')
    expect(meta.error).toBe('Invalid URL')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports HTTP errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      htmlResponse('', { status: 404, url: 'https://site.com/x' }),
    )
    const meta = await fetchBookmarkMetadata('https://site.com/x', { fetchImpl })
    expect(meta.status).toBe('error')
    expect(meta.error).toBe('HTTP 404')
  })

  it('reports a timeout when the request is aborted', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        )
      })
    const meta = await fetchBookmarkMetadata('https://slow.com', { fetchImpl, timeoutMs: 5 })
    expect(meta.status).toBe('timeout')
  })
})
