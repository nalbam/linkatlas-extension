# Changelog

All notable changes to LinkAtlas are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Purpose groups + multi-depth categories.** Organize now models each
  bookmark's placement as a folder **path** (大 root / 中 / 小, variable depth)
  instead of a single flat category:
  - **Purpose groups** — the user's own top-level folders under the bookmark bar
    (e.g. `karrot`, `nalbam`) are auto-detected and preserved as-is, ignoring AI
    category. Toggle any top-level folder between purpose and category in the UI.
  - **Category groups** — everything else is classified by AI; `category` +
    `subcategory` are interpreted as a `[中, 小]` path (existing analyses reused,
    no re-analysis needed). Unclassified bookmarks fall back to their original
    folder path until analyzed.
  - The organize view renders a **nested tree** with purpose/category origin
    chips; drag-and-drop, multi-select move, rename, and merge all target paths.
  - **Apply** creates nested folders directly under the chosen root (no more
    `LinkAtlas` container). Existing same-named folders are reused; rollback
    removes only the folders this apply created, so your existing folders are
    never deleted.
  - Persisted organize state is migrated from the v1 flat-category shape
    automatically (`'Dev'` → `['Dev']`).
- **大 (browser root) level in the organize tree.** The tree now shows the
  browser roots (북마크바 / 기타 북마크 / 모바일 북마크) as **read-only** top-level
  nodes, with the 中/小 category tree under each — the full 대/중/소 hierarchy.
  Bookmarks and folders can be dragged freely, **including between roots**; a
  bookmark keeps its original 大 until moved. Apply now creates each bookmark's
  path under its assigned root (the single "Create under" picker is gone).
  Persisted state migrates v1/v2 → v3 (adds an empty root-override map).
- **Reset.** A "리셋" button in the organize view clears all manual edits AND the
  AI classification cache, returning the tree to the current Chrome bookmarks'
  original folder structure (behind a confirm; not reversible). Distinct from
  Rollback, which undoes a change already applied to Chrome.
- **Expand/collapse persists across reloads.** The Tree view's expanded folders
  and the Organize view's collapsed nodes are saved to `chrome.storage.local`
  (via `uiStore`) and restored on reload; first-run still auto-expands top-level
  roots only when nothing was saved. Search/filter/sort stay ephemeral.
- **AI recategorize (collection-aware).** A new "AI로 재정리" action sends the
  collection to the LLM in **chunked calls** and groups similar sites into a small,
  consistent set of categories (~8–12 top-level, a 2nd level only for large
  groups) — fixing the per-bookmark analysis's inconsistent, over-split labels.
  The prompt favors **merging over splitting**: broad top-level categories, a
  sub-level only for genuinely large groups (~10+), and small stragglers folded into
  a broader category. Chunking keeps large collections from truncating; a failed
  chunk doesn't lose the rest, and inputs the model leaves unassigned are surfaced as
  failed. Each chunk reuses the categories earlier chunks chose (a **running
  taxonomy**), so labels stay consistent and the top level stays small instead of
  ballooning per chunk. When per-bookmark analysis (③) exists, its summary/tags feed
  the grouping. The bookmark
  bar (manual-only) and purpose groups are excluded, and **manually-moved bookmarks
  are kept** (shown with a "수동" badge — recategorize leaves them as-is). Results
  update each bookmark's category/subcategory (preserving summary/importance) and
  flow into the organize tree for preview + Apply. A scope + approximate-cost gate
  shows before anything is sent, and a long run is **cancellable**.
- **Pipeline guide.** A single across-the-top guide ties the five stages
  (수집 → 분석 → 정리 → 적용) into one flow: it highlights the current step, says what
  to do next, and offers a one-click switch when the next action lives in the other
  view. The active Tree/Organize view now persists across reloads, and Analyze warns
  when bookmarks lack collected metadata (analyzed on title/URL only).

### Changed

- **Resilient background jobs.** Metadata / analysis / recategorize / apply jobs
  now share one Port-client (`connectJob`) with consistent error/empty-input/done
  handling. The worker is kept alive with `chrome.alarms` + a periodic poke during
  long jobs, job progress is mirrored to `chrome.storage.session`, and a reloaded
  options page **re-attaches** to a job still running instead of losing its
  progress. A disconnect with no terminal message now surfaces as an error rather
  than a silent stop. Adds the `alarms` permission.
- **Recategorize-only records are re-analyzable.** A category produced by ④ alone
  (no per-bookmark analysis) is marked `summarized: false`, so it stays eligible for
  ③ analysis and doesn't pollute the Tree's category/tag views.

### Fixed

- Recategorize / analysis failures (API errors, denied host permission, or a
  model response with zero usable assignments) are now surfaced in the organize
  view instead of failing silently — `analysisStore` keeps the error and the
  "AI로 재정리" area shows it.
- Drop the deprecated `baseUrl` from `tsconfig.json` (flagged for removal in
  TypeScript 7.0) and make the `@/*` path mapping relative (`./src/*`), keeping
  module resolution unchanged.

## [0.5.3] — Tooling

### Changed

- Pin the npm registry via a root `.npmrc` and refine the release workflow.

No application or feature changes — the 0.5.0 feature set remains current.

## [0.5.2] — Tooling

### Changed

- Restore the committed `package-lock.json` for reproducible installs.

## [0.5.1] — Tooling

### Changed

- Streamline the release workflow and `.gitignore` (the lockfile dropped here was
  re-added in 0.5.2).

## [0.5.0] — Phase 5: Apply Changes to Chrome

### Added

- **Apply to Chrome**: materialize the category working plan as real Chrome
  bookmark folders — create a container ("LinkAtlas") under a chosen top-level
  folder, one subfolder per category, and move categorized bookmarks in. Runs as
  a background service-worker job with progress.
- **Preview + confirm gate** (`ApplyDialog`): shows categories, folders to
  create, bookmarks to move, and the target before anything changes; nothing is
  applied until the user confirms.
- **Post-apply summary** (folders created · bookmarks moved).
- **Rollback**: every apply records an incremental snapshot (original
  parent/index per moved bookmark + created folder ids); Rollback moves
  bookmarks back and removes the created folders. Uncategorized bookmarks and
  original folders are left untouched, so the undo is complete.
- Pure, tested apply planner (`buildApplyPlan`) that excludes Uncategorized and
  empty categories.

### Notes

- 62 passing unit tests; `typecheck` and `build` are green.
- Apply is destructive (it moves real bookmarks) but reversible; the most recent
  apply can be rolled back. No new permissions (uses the existing `bookmarks`).

## [0.4.0] — Phase 4: Category Management

### Added

- **Organize view** (toggle in the header) that groups bookmarks by category —
  a local working plan layered over AI categories, ready to apply to Chrome in a
  later phase. Chrome is untouched until then.
- Category operations as pure, tested reducers: **create**, **rename**, **merge**,
  **delete** (reassigns to Uncategorized), and **move** bookmarks. "Split" is
  create + move a selection.
- **Native drag-and-drop** (zero dependencies) to move bookmarks between category
  sections, plus checkbox multi-select with a "Move to…" action.
- **Undo** for every category change (in-session history) and a created-category
  list so empty categories persist.
- `organizeStore` (Zustand) persists the working state to `chrome.storage.local`;
  the effective category resolves override → AI category → Uncategorized.
- Extracted a shared `Favicon` component (reused by the tree and organize rows).

### Notes

- 60 passing unit tests; `typecheck` and `build` are green.
- The working state is the input for Phase 5 (preview + apply to Chrome).

## [0.3.0] — Phase 3: AI Analysis Flow

### Added

- AI analysis pipeline: each bookmark is analyzed into
  `{summary, category, subcategory, tags, importance, reason}` via the chosen
  provider, running as a background service-worker job over a typed Port with
  conservative concurrency (3) and incremental caching.
- Privacy + cost gate (`AnalyzeDialog`): shows scope count, provider, estimated
  input/output tokens, and an approximate cost **before** anything is sent;
  nothing leaves the browser until the user confirms.
- On-demand host permission for `https://api.openai.com/*`, requested from the
  user gesture on confirm (added to `optional_host_permissions`).
- Pure, tested analysis core: `buildAnalyzeInput` (bookmark + metadata → model
  input) and `estimateUsage` (token/cost estimate reusing the real prompt).
- Analysis overlay in the tree: per-bookmark importance badge (colored by score)
  and category chip; summary + tags in the row tooltip.
- New filtering/sorting: **sort by importance**, **filter by category**, and
  **filter by tag** — all reading from the analysis map through the existing
  pure derivation pipeline.
- Tag statistics drawer (`TagStatsPanel`): tag frequencies across analyzed
  bookmarks; click a tag to filter by it.
- `analysisStore` (Zustand) with throttled result merging and a cache hydrated on
  load; `createProvider` now accepts a model option.

### Notes

- 53 passing unit tests; `typecheck` and `build` are green.
- Analysis uses the OpenAI provider; Gemini and Claude remain drop-in behind the
  same `AIProvider` contract (the factory reports them as not-yet-implemented).
- Re-runs are incremental (successful analyses are skipped); cost is an estimate.

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

[0.5.3]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.5.3
[0.5.2]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.5.2
[0.5.1]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.5.1
[0.5.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.5.0
[0.4.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.4.0
[0.3.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.3.0
[0.2.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.2.0
[0.1.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.1.0
