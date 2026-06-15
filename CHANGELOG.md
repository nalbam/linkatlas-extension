# Changelog

All notable changes to LinkAtlas are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — Phase 2: URL Metadata Collection

### Added

- Per-bookmark metadata collection: title, description, OpenGraph (title /
  description / image), keywords, and favicon, fetched from the live page.
- DOM-free HTML metadata parser (`metadata/parseHtml.ts`) that runs in the
  service worker and is fully unit-tested (entities, quoted/unquoted attributes,
  keyword dedupe, favicon resolution + `/favicon.ico` fallback).
- Resilient fetcher (`metadata/fetchMetadata.ts`): per-request timeout via
  `AbortController`, redirect capture (`finalUrl`), and uniform error/timeout
  handling — never throws.
- Concurrency-limited batch runner (`utils/batch.ts`) providing rate limiting,
  ordered results, progress callbacks, and cooperative abort.
- Background service-worker job over a typed `chrome.runtime` Port: streams
  `progress`/`result`/`done` messages and flushes results to the cache
  incrementally so partial progress survives a worker shutdown.
- Metadata cache in `chrome.storage.local` (`meta:<url>`, 30-day TTL); collection
  is incremental (fresh records are skipped) and re-runs are instant.
- `metadataStore` (Zustand) with throttled result merging for large jobs, plus a
  `MetadataBar` UI with a progress bar, cancel, and last-run summary.
- Favicons and descriptions now render inline in the bookmark tree (favicon with
  a graceful globe fallback).
- On-demand `<all_urls>` host permission via `optional_host_permissions`,
  requested from the user gesture on the "Collect metadata" button.

### Notes

- 43 passing unit tests; `typecheck` and `build` are green.
- Metadata is read-only signal gathering; no data leaves the browser except the
  page requests the user explicitly authorizes.

## [0.1.0] — Phase 1: Foundation & Bookmark Vertical Slice

### Added

- Manifest V3 extension scaffold with Vite 7 + CRXJS, React 19, Tailwind CSS 4,
  Zustand, TanStack Query, and TanStack Virtual.
- Bookmark domain model and pure tree utilities (`extractDomain`, `searchTree`,
  `filterByDomain`, `sortTree`, `flattenVisible`, counts) with unit tests.
- Chrome Bookmarks adapter (`getBookmarkRoots`, pure `mapBookmarkNode`).
- Full-page manager (options page) with a virtualized bookmark tree:
  collapse/expand, search (title/URL/domain), domain filter, and sorting by
  original order / title / domain / recently added.
- Popup with live bookmark & folder counts and an "Open Manager" action.
- Settings drawer to select an AI provider and store its API key in
  `chrome.storage.local`.
- AI provider abstraction (`AIProvider`) with a fully implemented OpenAI provider
  using Chat Completions Structured Outputs, plus shared prompt/schema/parsing
  utilities — all unit-tested with an injected `fetch`.
- Documentation: README, ARCHITECTURE, ROADMAP, CHANGELOG.

### Notes

- AI analysis is not yet wired into the UI; metadata collection, category
  management, and apply-to-Chrome are scheduled for later phases (see ROADMAP).
- 28 passing unit tests; `typecheck` and `build` are green.

[0.2.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.2.0
[0.1.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.1.0
