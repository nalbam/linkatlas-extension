import { type ParsedMetadata } from './types'

/**
 * Pure HTML → metadata extraction using string/regex scanning of `<head>` tags.
 * Deliberately DOM-free so it runs in the MV3 service worker (no DOMParser) and
 * is trivially unit-testable. Scope is limited to title / meta / link icon —
 * which are simple, well-structured tags — so regex extraction is reliable.
 */

const MAX_KEYWORDS = 20

/** Read an HTML attribute value (double/single/unquoted) from a single tag. */
function attr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')
  const match = re.exec(tag)
  if (!match) return undefined
  return match[2] ?? match[3] ?? match[4]
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z0-9#]+);/gi, (whole, name: string) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? whole)
}

function clean(value: string | undefined): string | undefined {
  if (value == null) return undefined
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  return text || undefined
}

function resolveUrl(href: string | undefined, baseUrl: string): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href, baseUrl).href
  } catch {
    return undefined
  }
}

function defaultFavicon(baseUrl: string): string | undefined {
  try {
    return new URL('/favicon.ico', baseUrl).href
  } catch {
    return undefined
  }
}

export function parseHtmlMetadata(html: string, baseUrl: string): ParsedMetadata {
  // First occurrence of each name/property wins.
  const metas = new Map<string, string>()
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    const key = (attr(tag, 'property') ?? attr(tag, 'name'))?.toLowerCase()
    const content = attr(tag, 'content')
    if (key && content != null && !metas.has(key)) metas.set(key, content)
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)

  const keywords: string[] = []
  const seen = new Set<string>()
  for (const raw of (metas.get('keywords') ?? '').split(',')) {
    const keyword = clean(raw)
    if (!keyword) continue
    const dedupeKey = keyword.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    keywords.push(keyword)
    if (keywords.length >= MAX_KEYWORDS) break
  }

  // Prefer an explicit icon link; fall back to /favicon.ico at the origin.
  let faviconHref: string | undefined
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    const rel = attr(tag, 'rel')?.toLowerCase()
    if (rel && /\bicon\b/.test(rel)) {
      const href = attr(tag, 'href')
      if (href) {
        faviconHref = href
        if (rel === 'icon' || rel === 'shortcut icon') break
      }
    }
  }

  return {
    title: titleMatch ? clean(titleMatch[1]) : undefined,
    description: clean(metas.get('description')),
    ogTitle: clean(metas.get('og:title')),
    ogDescription: clean(metas.get('og:description')),
    ogImage: resolveUrl(clean(metas.get('og:image')), baseUrl),
    keywords,
    faviconUrl: resolveUrl(faviconHref, baseUrl) ?? defaultFavicon(baseUrl),
  }
}
