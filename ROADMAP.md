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

## Phase 2 — URL Metadata Collection ✅ (current)

- [x] Fetch per-bookmark metadata: title, favicon, description, OpenGraph,
      keywords (background service-worker fetch + DOM-free parser).
- [x] Batching + rate limiting + timeout/redirect/failure handling.
- [x] Metadata cache in `chrome.storage.local`; incremental refresh.
- [x] Show favicons and descriptions in the tree rows.
- [x] On-demand `<all_urls>` host permission via `optional_host_permissions`.
- [ ] Refinements: per-folder/selection scoping, "force refresh" of fresh
      records, and surfacing the favicon/keywords beyond the row tooltip.

## Phase 3 — AI Analysis Flow

- [ ] Wire `createProvider` + metadata into an analysis pipeline (background job).
- [ ] Privacy gate: "Analyze selected / folder / all" with explicit confirmation.
- [ ] Token-cost estimate shown **before** sending.
- [ ] Persist `BookmarkAnalysis` per bookmark; overlay category/tags/importance
      in the UI; enable **sort by importance** and **filter by tag/category**.
- [ ] Tag statistics view (counts, dedup) and incremental re-analysis.
- [ ] Add Gemini and Claude providers behind the existing `AIProvider` contract.

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

## Quality Gates — Phase 2 self-assessment

Scored for the cumulative deliverable through Phase 2. Target is ≥ 8; sub-8
items carry an explicit action.

| Dimension | Score | Notes |
| --- | --- | --- |
| Architecture | 9 | Clean layering; pure DOM-free metadata core; SW job over a typed Port; provider abstraction ready. |
| UX | 8 | Favicons + descriptions in rows, progress bar, cancel, incremental re-runs. Keyboard nav and richer metadata surfacing still pending. |
| Performance | 8 | Virtualized rows; concurrency-limited fetch; throttled store merges for large jobs. Live 10k-node + large-job profiling still pending. |
| Maintainability | 9 | Small focused modules (~2.3k LOC), 43 unit tests, pure cores tested without browser/network. |
| Security | 8 | Keys local-only; host access is `optional_host_permissions`, requested on demand from a user gesture; `credentials: 'omit'` on fetches. |

### Actions to maintain/raise scores

- **Perf:** profile with a 5k–10k synthetic set — scroll FPS, initial flatten,
  and a full metadata job; tune concurrency / flush interval if needed.
- **UX:** keyboard navigation, an "expand to match" affordance, and a panel
  surfacing full metadata (keywords, OG image) per bookmark.
- **Security:** keep host access opt-in; when AI sending lands (Phase 3), add the
  token-cost + explicit-scope gate before any provider call.

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
- Metadata `description`/`keywords` are surfaced inline/tooltip only; a richer
  per-bookmark detail view is a Phase 3 UX item.
