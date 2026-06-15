import { describe, expect, it, vi } from 'vitest'
import { OpenAIProvider } from './OpenAIProvider'

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response
}

const analysisJson = JSON.stringify({
  summary: 'React documentation.',
  category: 'Development',
  subcategory: 'Frontend',
  tags: ['React', 'react', 'UI'],
  importance: 8,
  reason: 'Primary reference for a popular framework.',
})

describe('OpenAIProvider', () => {
  it('sends an authorized json_schema request and parses the result', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ choices: [{ message: { content: analysisJson } }] }),
    )
    const provider = new OpenAIProvider('sk-test', { fetchImpl })

    const result = await provider.analyzeBookmark({
      title: 'React',
      url: 'https://react.dev',
      domain: 'react.dev',
    })

    expect(result.category).toBe('Development')
    expect(result.tags).toEqual(['React', 'UI']) // deduped by normalizer

    const [, init] = fetchImpl.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test')
    const payload = JSON.parse(init?.body as string)
    expect(payload.response_format.type).toBe('json_schema')
    expect(payload.messages[0].role).toBe('system')
  })

  it('throws the API error message on a non-200 response', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: { message: 'Invalid API key' } }, false, 401),
    )
    const provider = new OpenAIProvider('bad', { fetchImpl })

    await expect(
      provider.analyzeBookmark({ title: 't', url: 'https://x.com', domain: 'x.com' }),
    ).rejects.toThrow('Invalid API key')
  })
})
