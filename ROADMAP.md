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

## Phase 3 — AI Analysis Flow ✅

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

## Phase 4 — Category Management ✅

- [x] Editable working state (`organizeStore`) separate from the Chrome tree.
- [x] Rename / merge / split / create / delete categories (pure, tested reducers).
- [x] Drag-and-drop move of bookmarks (native HTML5) + multi-select "Move to".
- [x] Immediate local-state updates with undo; persisted to storage.

## Phase 5 — Apply Changes to Chrome ✅

- [x] Preview the plan (folders to create, bookmarks to move, target) before applying.
- [x] Apply via Bookmarks API: create category folders + move categorized
      bookmarks (background job). *(Phase 6 drops the container — folders are
      created directly under the chosen root.)*
- [x] Post-apply summary (folders created / bookmarks moved).
- [x] Rollback support (incremental snapshot + restore; complete undo).
- [ ] Refinements: optional delete-empty-folders (with snapshot-based recreate),
      multi-apply history, rename existing folders, dry-run diff view.

## Phase 6 — Purpose groups, 大/中/小 hierarchy & collection recategorize ✅

- [x] Path-based organize model (中/小 path under a 大 root) replacing flat
      categories; persisted state migrates v1/v2 → v3.
- [x] **Purpose groups** — the user's own bookmark-bar folders are preserved as-is
      and skip AI classification; any top-level folder toggles purpose↔category.
- [x] **大 (browser roots)** — 북마크바 / 기타 북마크 shown read-only at the top, with
      a 대/중/소 hierarchy under each. Bookmarks and folders move freely, across roots.
- [x] **Collection-aware recategorize** — the whole collection goes to the LLM in
      one call → a small, consistent category hierarchy (~8–12 top-level, 2nd level
      only for large groups). Bookmark bar excluded (managed manually). Errors surfaced.
- [x] **Reset** (clear edits + AI classification → original folders); expand/collapse
      state persists across reloads.
- [x] Apply creates each bookmark's path under its assigned root (no container).
- [ ] Refinements: tag-based grouping, per-root recategorize, virtualize organize rows.

## All success criteria met 🎉

The core purpose, end-to-end:
① read Chrome bookmarks → ② fetch each page + analyze the site with an LLM →
③ the LLM re-clusters the collection into a category hierarchy → ④ edit categories
→ ⑤ apply to Chrome (with rollback). The unchecked items above and in
"Technical Debt" are refinements, not gaps in the core flow.

## Quality Gates — Phase 5 self-assessment

Scored for the complete MVP (all phases). Target is ≥ 8; sub-8 items carry an
explicit action.

| Dimension | Score | Notes |
| --- | --- | --- |
| Architecture | 9 | Three SW jobs share one Port/cache/store pattern; apply is a pure planner + reversible worker; consistent layering across all phases. |
| UX | 8 | Full flow with preview + confirm + summary + rollback. Per-bookmark detail view and a dry-run diff list still pending. |
| Performance | 8 | Tree virtualized; jobs rate-limited; apply moves are sequential. Organize rows not virtualized; large-set profiling still pending. |
| Maintainability | 9 | Small focused modules, 111 unit tests; every domain core (paths, grouping, recategorize, apply plan, migration) tested without browser/network. |
| Security | 9 | Keys local-only; host access opt-in; the destructive apply is gated by an explicit preview/confirm and is fully reversible via snapshot. |

### Actions to maintain/raise scores

- **Perf:** virtualize organize rows; profile a 5k–10k synthetic set across all
  flows, including a large apply + rollback.
- **UX:** per-bookmark detail panel, a dry-run diff list in the apply preview,
  keyboard navigation.
- **Coverage:** add Gemini/Claude providers (contract ready) and component/E2E
  tests for the DnD + apply/rollback flows (the parts not covered by pure tests).

## Technical Debt & TODOs

- A very large metadata job can outlive the service worker's idle lifetime; the
  active fetch/Port keeps it alive and the cache preserves partial results
  (incremental resume on re-run), but a chunked/resumable queue would be more
  robust for 5k+ jobs.
- No icon assets yet (extension uses the default action icon).
- Metadata uses background `fetch`, not content scripts, so there is no
  `src/content/`; one would only be needed for in-page extraction of
  JS-rendered pages.
- Component/E2E tests (React Testing Library) still deferred; coverage is on pure
  logic, so the DnD + apply/rollback interactions are unverified by automated tests.
- Metadata `description`/`keywords` and analysis `summary`/`subcategory`/`reason`
  are surfaced via the row tooltip only; a richer per-bookmark detail view is
  pending.
- No model selector or custom-category steering in Settings yet; analysis uses
  the provider's default model. Already-analyzed bookmarks can't be re-analyzed
  from the UI without clearing storage.
- Only the OpenAI provider is wired (analyze + recategorize); Gemini/Claude are
  contract-ready but not implemented.
- Organize rows are not virtualized; a single very large category renders all its
  rows inside a scroll container.
- Apply keeps now-empty original folders (deliberate, for clean rollback);
  deleting them is a future opt-in that needs snapshot-based folder recreate.
- Rollback covers the **most recent** apply only; applying again replaces the
  snapshot. No multi-step apply history yet.
