# Architecture

LinkAtlas is built as layered, feature-isolated TypeScript with a strict split
between **pure domain logic** (no Chrome, no React — fully unit-tested) and the
**framework shell** (React UI, Chrome adapters, async orchestration).

## Layers

```
┌────────────────────────────────────────────────────────────┐
│ Surfaces        popup/          options/ (full-page app)    │
│                 background/ (MV3 service worker)            │
├────────────────────────────────────────────────────────────┤
│ UI              ui/components   options/components + hooks   │
├────────────────────────────────────────────────────────────┤
│ State           state/ (Zustand stores) + selectors (pure)  │
│                 utils/queryClient (TanStack Query)          │
├────────────────────────────────────────────────────────────┤
│ Services        services/ (framework-agnostic data access)  │
├────────────────────────────────────────────────────────────┤
│ Domain          bookmarks/ (model + pure tree utils)        │
│                 ai/ (provider abstraction + prompts)        │
├────────────────────────────────────────────────────────────┤
│ Adapters        bookmarks/chromeBookmarks  ai/providers/*   │
│                 utils/chromeStorage                         │
└────────────────────────────────────────────────────────────┘
```

Dependencies point downward only. `bookmarks/tree.ts`, `state/selectors.ts`, and
`ai/prompts.ts` import nothing from React or Chrome, which is what keeps them
fast and trivially testable.

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

## Module Map

| Path | Responsibility |
| --- | --- |
| `bookmarks/types.ts` | Domain model (`TreeNode` = folder \| bookmark), `FlatNode`, `SortKey`. |
| `bookmarks/tree.ts` | Pure utils: `extractDomain`, `searchTree`, `filterByDomain`, `sortTree`, `flattenVisible`, counts. |
| `bookmarks/chromeBookmarks.ts` | `chrome.bookmarks` adapter + pure `mapBookmarkNode`. |
| `services/bookmarkService.ts` | Query keys + `loadBookmarkTree`. |
| `state/uiStore.ts` | Search / filter / sort / expanded view state. |
| `state/settingsStore.ts` | Provider choice + API keys (persisted). |
| `state/selectors.ts` | `selectVisibleRows` derivation pipeline. |
| `ai/types.ts` | `AIProvider`, `BookmarkAnalysis`, `AnalyzeInput`. |
| `ai/prompts.ts` | System prompt, JSON schema, `normalizeAnalysis`, parsing. |
| `ai/providers/OpenAIProvider.ts` | OpenAI Chat Completions client. |
| `ai/providers/index.ts` | `createProvider` factory. |
| `options/App.tsx` | Composition root for the manager. |
| `background/index.ts` | Service worker lifecycle (extends in later phases). |

## Testing Strategy

Pure modules carry the test weight: `bookmarks/tree`, `state/selectors`,
`ai/prompts`, and `ai/providers/OpenAIProvider` (with an injected `fetch`). This
covers search/filter/sort/flatten correctness, the derivation pipeline, response
normalization, and the provider request/parse contract without a browser or
network. Run with `npm test`.
