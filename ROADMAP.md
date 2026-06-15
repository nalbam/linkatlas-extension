# Roadmap

LinkAtlas is built in vertical slices. Each phase ships something usable and is
evaluated against the quality gates before the next begins.

## Phase 1 — Foundation & Bookmark Vertical Slice ✅

- [x] MV3 + Vite + CRXJS + React + Tailwind toolchain, typecheck & build green.
- [x] Bookmark domain model + Chrome adapter + pure tree utilities (tested).
- [x] Read full bookmark tree (TanStack Query) preserving hierarchy.
- [x] Virtualized tree view (TanStack Virtual) for 10k+ nodes.
- [x] Search (title/URL/domain), domain filter, sort, expand/collapse.
- [x] Popup with counts + "Open Manager"; settings drawer for provider/API key.
- [x] AI provider abstraction + OpenAI implementation (Structured Outputs, tested).
- [x] Docs: README / ARCHITECTURE / ROADMAP / CHANGELOG.

## Phase 2 — URL Metadata Collection ✅

- [x] Fetch per-bookmark metadata: title, favicon, description, OpenGraph,
      keywords (background service-worker fetch + DOM-free parser).
- [x] Batching + rate limiting + timeout/redirect/failure handling.
- [x] Metadata cache in `chrome.storage.local`; incremental refresh.
- [x] Show favicons and descriptions in the tree rows.
- [x] On-demand `<all_urls>` host permission via `optional_host_permissions`.

## Phase 3 — AI Analysis Flow ✅ (current)

- [x] Wire `createProvider` + metadata into an analysis pipeline (background job).
- [x] Privacy gate with explicit confirmation; scope follows the active filters.
- [x] Token-cost estimate shown **before** sending.
- [x] Persist analysis per bookmark; overlay category/importance in the UI;
      **sort by importance** and **filter by category/tag**.
- [x] Tag statistics view (counts, dedup) and incremental re-analysis.
- [ ] Add Gemini and Claude providers behind the existing `AIProvider` contract.
- [ ] Refinements: model selector + custom categories in Settings; per-folder
      scope picker; "re-analyze" of already-analyzed bookmarks; per-bookmark
      detail view (summary, subcategory, reason).

## Phase 4 — Category & Tag Management

- [ ] Editable working tree (new Zustand store) separate from the Chrome tree.
- [ ] Rename / merge / split / create / delete categories.
- [ ] Drag-and-drop move of bookmarks and folders.
- [ ] Immediate local-state updates with undo.

## Phase 5 — Apply Changes to Chrome

- [ ] Diff working tree vs. Chrome; **preview** before applying.
- [ ] Apply via Bookmarks API: create/rename/move/delete, reorganize hierarchy.
- [ ] Post-apply summary (moved / created / merged / deleted counts).
- [ ] Rollback support (snapshot + restore).

## Quality Gates — Phase 3 self-assessment

Scored for the cumulative deliverable through Phase 3. Target is ≥ 8; sub-8
items carry an explicit action.

| Dimension | Score | Notes |
| --- | --- | --- |
| Architecture | 9 | Two SW jobs share one Port/batch/cache/store pattern; provider abstraction now exercised end-to-end; pure cores throughout. |
| UX | 8 | Importance/category overlays, tag stats, cost gate, progress/cancel. Per-bookmark detail view + model selector still pending. |
| Performance | 8 | Virtualized rows; concurrency-limited jobs; throttled merges. Live 10k-node + large-job profiling still pending. |
| Maintainability | 9 | Small focused modules (~3.0k LOC), 53 unit tests; analysis/metadata cores tested without browser/network. |
| Security | 9 | Keys local-only; every host (`<all_urls>`, `api.openai.com`) is opt-in via user gesture; explicit cost/scope gate before any send; `credentials: 'omit'`. |

### Actions to maintain/raise scores

- **Perf:** profile with a 5k–10k synthetic set — scroll FPS, initial flatten,
  and full metadata/analysis jobs; tune concurrency / flush interval if needed.
- **UX:** per-bookmark detail panel (summary/subcategory/reason), a model +
  custom-category selector in Settings, keyboard navigation.
- **Coverage:** add Gemini/Claude providers (contract is ready) so the abstraction
  is proven by more than one implementation.

## Technical Debt & TODOs

- A very large metadata job can outlive the service worker's idle lifetime; the
  active fetch/Port keeps it alive and the cache preserves partial results
  (incremental resume on re-run), but a chunked/resumable queue would be more
  robust for 5k+ jobs.
- No icon assets yet (extension uses the default action icon).
- Metadata uses background `fetch`, not content scripts, so `src/content/` stays
  unused for now (would only be needed for in-page extraction of JS-rendered
  pages).
- Component-level tests (React Testing Library) deferred; current coverage is on
  pure logic. Add interaction tests when management/DnD (Phase 4) lands.
- Editable working-tree store intentionally omitted until Phase 4 (would be
  unused before then).
- Metadata `description`/`keywords` and analysis `summary`/`subcategory`/`reason`
  are surfaced via the row tooltip only; a richer per-bookmark detail view is
  pending.
- No model selector or custom-category steering in Settings yet; analysis uses
  the provider's default model. Already-analyzed bookmarks can't be re-analyzed
  from the UI without clearing storage.
- Only the OpenAI provider is wired for analysis; Gemini/Claude are contract-ready
  but not implemented.
