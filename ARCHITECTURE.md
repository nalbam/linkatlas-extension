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
Domain     bookmarks/ (model + tree utils) · metadata/ (parser/fetcher/cache)
           analysis/ (input/estimate/recategorize/cache) · organize/ (path + grouping + reducers)
           apply/ (planner + snapshot) · ai/ (abstraction + prompts)
Adapters   chromeBookmarks · metadata/cache · analysis/cache · apply/snapshot
           ai/providers/* · utils/chromeStorage
           background jobs (metadata + analysis + recategorize + apply/rollback)
```

Dependencies point downward only. `bookmarks/tree.ts`, `state/selectors.ts`,
`metadata/parseHtml.ts`, `utils/batch.ts`, `analysis/estimate.ts`,
`analysis/analyzeInput.ts`, `analysis/recategorize.ts`, `organize/path.ts`,
`organize/operations.ts`, `apply/plan.ts`, and `ai/prompts.ts` import nothing from
React or Chrome, which is what keeps them fast and trivially testable.

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

## Data Flow (analysis path)

```
AnalyzeDialog (privacy + cost gate)
  → estimateUsage(inputs)                 (token/cost preview, pure)
  → chrome.permissions.request(api.openai.com)
  → analysisStore.startAnalysis           (filtered bookmarks lacking analysis)
  → Port "linkatlas-analysis" → background
        createProvider(provider, apiKey, {model})
        runAnalysisJob: runBatch(items, provider.analyzeBookmark, concurrency=3)
          → setManyCachedAnalysis (incremental) → post {progress|result|done}
  → analysisStore merges results (throttled) into byUrl
  → selectVisibleRows uses analysis for importance sort + category/tag filter
  → rows show importance badge + category chip; TagStatsPanel aggregates tags
```

The analysis path mirrors the metadata path (same Port + `runBatch` + cache +
store pattern), differing only in the worker (`provider.analyzeBookmark` instead
of `fetchBookmarkMetadata`). The **scope** is the bookmarks matching the active
filters (`selectFilteredBookmarks`), so filtering narrows what gets sent.

## Category Management (working state)

The Organize view edits a **working plan**, not Chrome. A bookmark's placement is
a **path** of 中/小 segments under a **大 root** (大 = bookmark bar / other —
fixed by the browser). `organizeStore` holds `OrganizeState = { overrides,
rootOverrides, extraPaths, purposeRoots }`; `effectivePath` resolves the path as
`manual override → original folder path when its top folder is a purpose root
(AI ignored) → AI [category, subcategory] → original folder path → Uncategorized`,
and `effectiveRoot` is `rootOverride → original 大`. `buildRootTree` buckets
bookmarks by 大 (rendered read-only) and, within each, the existing `buildPathTree`
builds the nested 中/小 tree. All mutations are pure, membership-agnostic reducers
in `organize/operations.ts` (create / move / rename / merge / delete /
`togglePurposeRoot` / `moveBookmarksToRoot` / `moveSubtreeToRoot`) — the caller
passes the affected placements computed from the current grouping. The store keeps
an in-session undo history plus a full `reset`, and persists the current state
(migrated v1/v2 → v3).

**Collection recategorize** (`analysis/recategorize.ts` + `background/recategorizeJob.ts`)
sends the whole collection to the LLM in one call — grouping similar sites into a
small category hierarchy — and updates each bookmark's AI `category`/`subcategory`,
which flows into the same tree (the bookmark bar + purpose groups are excluded and
managed manually). This working plan is the input to the apply step.

## Apply & Rollback (the only Chrome mutation)

Applying the plan is the one place LinkAtlas writes to Chrome. `buildApplyPlan`
walks the 大 forest into assignments `{rootId, path, bookmarkIds}` (excluding
Uncategorized + empty), shown in `ApplyDialog` as a preview. On confirm,
`runApplyJob` (service worker) ensures each assignment's nested folder path
**directly under its assigned 大 root** (`ensureFolder` reuses same-named ones, so
it merges into folders you already have — no container) and moves each bookmark in
— **sequentially**, to avoid index races.

Reversibility is built in: before each move the bookmark's original
`{parentId, index}` is recorded to an `ApplySnapshot` (plus the ids of folders we
created), persisted incrementally so even an interrupted apply is undoable.
`runRollbackJob` moves bookmarks back (reverse order) and removes the created
folders. Because bookmark ids are stable across moves and original folders are
never deleted, rollback fully restores the prior arrangement. The snapshot is
single-slot — rollback undoes the most recent apply.

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
  `analyzeBookmark` (per-bookmark) and `recategorize` (whole-collection in one
  call). Request building and response parsing (`ai/prompts.ts`) are pure and
  shared, so providers stay thin and testable. OpenAI uses Chat Completions
  **Structured Outputs** (`response_format: json_schema`) for schema-guaranteed
  results.
- **Local-only secrets**: API keys persist through a `chrome.storage.local`
  Zustand adapter (`utils/chromeStorage.ts`) — never bundled, never synced.
- **On-demand host access**: every host is `optional_host_permissions`, requested
  from a user gesture — `<all_urls>` on "Collect metadata", `api.openai.com` on
  Analyze confirm. The extension ships with zero host access.
- **AI sending behind a gate**: `AnalyzeDialog` shows scope + token/cost estimate
  and requires explicit confirm before any provider call. The estimate reuses the
  real prompt builder so it tracks what is actually sent. Cost rates live in one
  constant (`analysis/estimate.ts`), labelled approximate.

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
| `analysis/analyzeInput.ts` | Build model input from bookmark + metadata (pure). |
| `analysis/estimate.ts` | Token/cost estimate for the privacy gate (pure). |
| `analysis/cache.ts` | `chrome.storage.local` analysis cache + freshness. |
| `organize/path.ts` | `Path` utils, `effectivePath` (priority resolution), `rebasePrefix`, `UNCATEGORIZED`. |
| `organize/operations.ts` | Pure 大-forest grouping (`buildRootTree`/`buildPathTree`) + reducers (move / rename / merge / delete / create / `togglePurposeRoot` / move-to-root). |
| `organize/migrate.ts` | Persisted `OrganizeState` v1/v2 → v3 migration. |
| `analysis/recategorize.ts` | Build recategorize inputs (bar/purpose excluded) + fold assignments into analysis (pure). |
| `apply/plan.ts` | Pure `buildApplyPlan` (per-大 assignments from the root forest). |
| `apply/snapshot.ts` | Single-slot rollback snapshot in storage. |
| `utils/batch.ts` | Concurrency-limited batch runner (rate limit + progress + abort). |
| `background/messages.ts` | Typed Port contracts (metadata + analysis/recategorize + apply). |
| `background/metadataJob.ts` | Fetch + cache + stream job. |
| `background/analysisJob.ts` | Analyze + cache + stream job. |
| `background/recategorizeJob.ts` | One-call collection recategorize → update analysis cache + stream. |
| `background/applyJob.ts` | Apply + rollback (ensure nested path per 大 root, move bookmarks, snapshot). |
| `state/uiStore.ts` | Search / domain / category / tag / sort + tree-expanded + organize-collapsed (expand/collapse persisted). |
| `state/settingsStore.ts` | Provider choice + API keys (persisted). |
| `state/metadataStore.ts` | Collected metadata (`byUrl`) + job progress (Port client). |
| `state/analysisStore.ts` | AI analysis (`byUrl`) + job progress (Port client). |
| `state/organizeStore.ts` | Path working state (overrides / rootOverrides / extraPaths / purposeRoots) + undo + reset (persisted, v3). |
| `state/applyStore.ts` | Apply/rollback job progress + summary + snapshot flag. |
| `state/selectors.ts` | `selectVisibleRows` + `selectFilteredBookmarks`. |
| `ai/types.ts` | `AIProvider` (`analyzeBookmark` + `recategorize`), `BookmarkAnalysis`, `AnalyzeInput`, `RecategorizeInput`/`Assignment`. |
| `ai/prompts.ts` | Analyze + recategorize system prompts, JSON schemas, `normalize`/parse. |
| `ai/providers/OpenAIProvider.ts` | OpenAI Chat Completions client. |
| `ai/providers/index.ts` | `createProvider` factory. |
| `options/App.tsx` | Composition root for the manager. |
| `background/index.ts` | Service worker lifecycle + metadata / analysis+recategorize / apply Port routers. |

## Testing Strategy

Pure modules carry the test weight: `bookmarks/tree`, `state/selectors`,
`metadata/parseHtml`, `metadata/fetchMetadata` (injected `fetch`), `utils/batch`,
`analysis/analyzeInput`, `analysis/estimate`, `analysis/recategorize`,
`organize/path`, `organize/operations`, `organize/migrate`, `apply/plan`,
`ai/prompts`, and `ai/providers/OpenAIProvider` (injected `fetch`). This covers
search/filter/sort/flatten, the derivation pipeline, HTML extraction, fetch
error/timeout/redirect handling, batch concurrency/abort, input building, usage
estimation, path resolution + 大-forest grouping, the path reducers, recategorize
input/apply, state migration, the apply planner, response normalization, and the
provider contract — all without a browser or network (111 unit tests). Run with
`npm test`.
