import { parseHtmlMetadata } from './parseHtml'
import { type BookmarkMetadata, type MetadataStatus } from './types'

interface FetchMetadataOptions {
  timeoutMs?: number
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 8000

function failure(
  url: string,
  error: string,
  status: MetadataStatus = 'error',
  finalUrl?: string,
): BookmarkMetadata {
  return { url, finalUrl, status, error, keywords: [], fetchedAt: Date.now() }
}

/**
 * Fetch one bookmark's page and extract metadata. Never throws — every failure
 * mode (invalid URL, unsupported protocol, HTTP error, timeout, network error)
 * resolves to a `BookmarkMetadata` with a non-'ok' status, so callers/batches
 * can treat the result uniformly. Redirects are followed and the final URL is
 * captured from `response.url`.
 */
export async function fetchBookmarkMetadata(
  url: string,
  options: FetchMetadataOptions = {},
): Promise<BookmarkMetadata> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch.bind(globalThis) } = options

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return failure(url, 'Invalid URL')
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return failure(url, `Unsupported protocol: ${parsedUrl.protocol}`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      credentials: 'omit',
    })
    const finalUrl = response.url || url
    if (!response.ok) {
      return failure(url, `HTTP ${response.status}`, 'error', finalUrl)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !contentType.includes('html')) {
      // Non-HTML (PDF, image, …): nothing to parse, but the URL is reachable.
      return { url, finalUrl, status: 'ok', keywords: [], fetchedAt: Date.now() }
    }

    const html = await response.text()
    const parsed = parseHtmlMetadata(html, finalUrl)
    return {
      url,
      finalUrl,
      status: 'ok',
      title: parsed.title,
      description: parsed.description ?? parsed.ogDescription,
      ogTitle: parsed.ogTitle,
      ogDescription: parsed.ogDescription,
      ogImage: parsed.ogImage,
      keywords: parsed.keywords,
      faviconUrl: parsed.faviconUrl,
      fetchedAt: Date.now(),
    }
  } catch (error) {
    if (controller.signal.aborted) return failure(url, 'Timed out', 'timeout')
    return failure(url, (error as Error).message || 'Network error')
  } finally {
    clearTimeout(timer)
  }
}
