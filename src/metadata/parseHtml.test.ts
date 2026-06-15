import { describe, expect, it } from 'vitest'
import { parseHtmlMetadata } from './parseHtml'

const BASE = 'https://example.com/page'

describe('parseHtmlMetadata', () => {
  it('extracts title, description, OpenGraph and resolved favicon', () => {
    const html = `
      <html><head>
        <title>Acme &amp; Co — Home</title>
        <meta name="description" content="Best widgets online.">
        <meta property="og:title" content="Acme OG">
        <meta property="og:description" content="OG description">
        <meta property="og:image" content="/img/cover.png">
        <link rel="icon" href="/favicon-32.png">
      </head><body></body></html>`
    const meta = parseHtmlMetadata(html, BASE)
    expect(meta.title).toBe('Acme & Co — Home')
    expect(meta.description).toBe('Best widgets online.')
    expect(meta.ogTitle).toBe('Acme OG')
    expect(meta.ogImage).toBe('https://example.com/img/cover.png')
    expect(meta.faviconUrl).toBe('https://example.com/favicon-32.png')
  })

  it('dedupes and trims comma-separated keywords', () => {
    const html = `<meta name="keywords" content="React, react ,  AWS, AWS,Kubernetes">`
    expect(parseHtmlMetadata(html, BASE).keywords).toEqual(['React', 'AWS', 'Kubernetes'])
  })

  it('falls back to /favicon.ico when no icon link is present', () => {
    const meta = parseHtmlMetadata('<title>x</title>', BASE)
    expect(meta.faviconUrl).toBe('https://example.com/favicon.ico')
  })

  it('handles single-quoted and unquoted attributes', () => {
    const html = `<meta name='description' content=Hello>`
    expect(parseHtmlMetadata(html, BASE).description).toBe('Hello')
  })

  it('returns undefined fields for empty content', () => {
    const meta = parseHtmlMetadata('<html></html>', BASE)
    expect(meta.title).toBeUndefined()
    expect(meta.description).toBeUndefined()
    expect(meta.keywords).toEqual([])
  })
})
