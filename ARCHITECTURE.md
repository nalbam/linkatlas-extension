# Architecture

LinkAtlas is built as layered, feature-isolated TypeScript with a strict split
between **pure domain logic** (no Chrome, no React — fully unit-tested) and the
**framework shell** (React UI, Chrome adapters, async orchestration).

## Layers

```
Surfaces   popup/ · options/ (full-page app) · background/ (MV3 service worker)
UI         ui/components · options/components + hooks
State      state/ (Zustand stores) + selectors (pure) · utils/queryClient
Services   services/ (framework-agnostic data access)
Domain     bookmarks/ (model + tree utils) · metadata/ (parser/fetcher/cache) · ai/ (abstraction + prompts)
Adapters   bookmarks/chromeBookmarks · metadata/cache · ai/providers/* · utils/chromeStorage · background job
```

Dependencies point downward only. `bookmarks/tree.ts`, `state/selectors.ts`,
`metadata/parseHtml.ts`, `utils/batch.ts`, and `ai/prompts.ts` import nothing
from React or Chrome, which is what keeps them fast and trivially testable.

## Data Flow (read path)

```
chrome.bookmarks.getTree()
  → chromeBookmarks.mapBookmarkNode   (raw → domain TreeNode, domain extracted)
  → bookmarkService.loadBookmarkTree  (framework-agnostic)
  → useBookmarkTree (TanStack Query)  (cache, loading/error)
  → App: selectVisibleRows(roots, uiState)
        = filterByDomain → searchTree → sortTree → flattenVisible
  → BookmarkTreeView (TanStack Virtual renders only visible rows)
```

UI intent (search text, domain filter, sort key, expanded set) lives in the
Zustand `uiStore`. The bookmark data itself is **server state** owned by TanStack
Query (Chrome is the "server"). This separation avoids duplicating the tree into
a store and keeps re-renders scoped.

## Data Flow (metadata path)

```
MetadataBar click
  → chrome.permissions.request(<all_urls>)      (on-demand host consent)
  → metadataStore.startCollection(urls)         (urls lacking a fresh cache record)
  → Port "linkatlas-metadata" → background
        runMetadataJob:
          runBatch(urls, fetchBookmarkMetadata, concurrency=5)
            → parseHtmlMetadata(html)            (DOM-free, in the worker)
          → setManyCachedMetadata (incremental flush)
          → post {progress|result|done}
  → metadataStore merges results (throttled) into byUrl
  → BookmarkTreeView rows show favicon + description
```

The fetch lives in the **service worker** (survives teardown, and host
permission lets it read cross-origin bodies). The worker has no DOMParser, so
parsing is pure string/regex (`metadata/parseHtml.ts`) — which also makes it
unit-testable. Metadata is keyed by URL in `metadataStore`, never embedded in the
Query tree, and merged into rows at render.

## Key Decisions

- **CRXJS + Vite** for MV3 bundling: the manifest (`src/manifest.config.ts`) is
  the single source of truth; CRXJS resolves HTML/TS entry points and the
  service worker, and provides HMR.
- **Options page as the main app** (`options_ui.open_in_tab: true`). A full tab
  is the right surface for a tree of thousands of nodes; the popup is a light
  launcher.
- **Derivation as one pure pipeline** (`selectVisibleRows`) so the entire
  filter→search→sort→flatten chain is memoizable and unit-tested in isolation.
- **Virtualization via flatten-then-window**: the expanded tree is flattened to
  a `FlatNode[]` (each row carries its `depth`), then `@tanstack/react-virtual`
  mounts only the visible slice. This is the standard pattern for arbitrary-depth
  trees and is what delivers the 10k-node performance goal.
- **AI provider abstraction** (`ai/types.ts#AIProvider`): every vendor implements
  one `analyzeBookmark` contract. Request building and response parsing
  (`ai/prompts.ts`) are pure and shared, so providers stay thin and testable.
  OpenAI uses Chat Completions **Structured Outputs** (`response_format:
  json_schema`) for schema-guaranteed results.
- **Local-only secrets**: API keys persist through a `chrome.storage.local`
  Zustand adapter (`utils/chromeStorage.ts`) — never bundled, never synced.
- **On-demand host access**: page fetching uses `optional_host_permissions`
  (`<all_urls>`), requested from the user gesture on "Collect metadata". The
  extension ships with zero host access.

## Module Map

| Path | Responsibility |
| --- | --- |
| `bookmarks/types.ts` | Domain model (`TreeNode` = folder \| bookmark), `FlatNode`, `SortKey`. |
| `bookmarks/tree.ts` | Pure utils: `extractDomain`, `searchTree`, `filterByDomain`, `sortTree`, `flattenVisible`, counts, `collectBookmarkUrls`. |
| `bookmarks/chromeBookmarks.ts` | `chrome.bookmarks` adapter + pure `mapBookmarkNode`. |
| `services/bookmarkService.ts` | Query keys + `loadBookmarkTree`. |
| `metadata/parseHtml.ts` | Pure DOM-free HTML → metadata extraction. |
| `metadata/fetchMetadata.ts` | Resilient single-URL fetch (timeout/redirect/error). |
| `metadata/cache.ts` | `chrome.storage.local` metadata cache + freshness. |
| `utils/batch.ts` | Concurrency-limited batch runner (rate limit + progress + abort). |
| `background/messages.ts` | Typed Port message contract. |
| `background/metadataJob.ts` | Fetch + cache + stream job. |
| `state/uiStore.ts` | Search / filter / sort / expanded view state. |
| `state/settingsStore.ts` | Provider choice + API keys (persisted). |
| `state/metadataStore.ts` | Collected metadata (`byUrl`) + job progress (Port client). |
| `state/selectors.ts` | `selectVisibleRows` derivation pipeline. |
| `ai/types.ts` | `AIProvider`, `BookmarkAnalysis`, `AnalyzeInput`. |
| `ai/prompts.ts` | System prompt, JSON schema, `normalizeAnalysis`, parsing. |
| `ai/providers/OpenAIProvider.ts` | OpenAI Chat Completions client. |
| `ai/providers/index.ts` | `createProvider` factory. |
| `options/App.tsx` | Composition root for the manager. |
| `background/index.ts` | Service worker lifecycle + metadata Port router. |

## Testing Strategy

Pure modules carry the test weight: `bookmarks/tree`, `state/selectors`,
`metadata/parseHtml`, `metadata/fetchMetadata` (injected `fetch`), `utils/batch`,
`ai/prompts`, and `ai/providers/OpenAIProvider` (injected `fetch`). This covers
search/filter/sort/flatten, the derivation pipeline, HTML extraction,
fetch error/timeout/redirect handling, batch concurrency/abort, response
normalization, and the provider contract — all without a browser or network.
Run with `npm test`.
