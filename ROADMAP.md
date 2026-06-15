# Roadmap

LinkAtlas is built in vertical slices. Each phase ships something usable and is
evaluated against the quality gates before the next begins.

## Phase 1 — Foundation & Bookmark Vertical Slice ✅ (current)

- [x] MV3 + Vite + CRXJS + React + Tailwind toolchain, typecheck & build green.
- [x] Bookmark domain model + Chrome adapter + pure tree utilities (tested).
- [x] Read full bookmark tree (TanStack Query) preserving hierarchy.
- [x] Virtualized tree view (TanStack Virtual) for 10k+ nodes.
- [x] Search (title/URL/domain), domain filter, sort, expand/collapse.
- [x] Popup with counts + "Open Manager"; settings drawer for provider/API key.
- [x] AI provider abstraction + OpenAI implementation (Structured Outputs, tested).
- [x] Docs: README / ARCHITECTURE / ROADMAP / CHANGELOG.

## Phase 2 — URL Metadata Collection

- [ ] Fetch per-bookmark metadata: title, favicon, description, OpenGraph,
      keywords (content script + background fetch).
- [ ] Batching + rate limiting + timeout/redirect/failure handling.
- [ ] Metadata cache in `chrome.storage.local`; incremental refresh.
- [ ] Show favicons and descriptions in the tree rows.
- [ ] Add `host_permissions` (requested narrowly / on demand).

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

## Quality Gates — Phase 1 self-assessment

Scored for the **Phase 1 deliverable scope** (the foundation slice), not the
full product. Target is ≥ 8; sub-8 items carry an explicit action.

| Dimension | Score | Notes |
| --- | --- | --- |
| Architecture | 9 | Clean layering, pure domain core, provider abstraction in place. |
| UX | 8 | Fast tree, search/filter/sort, clear empty/error states. Favicons & keyboard nav pending (Phase 2+). |
| Performance | 8 | Virtualized rows; memoized pipeline. Not yet profiled at 10k live nodes (action below). |
| Maintainability | 9 | Small focused modules (~1.6k LOC), 28 unit tests, typed throughout. |
| Security | 8 | Keys local-only; minimal permissions (`bookmarks`, `storage`); no host perms yet. Re-audit when metadata fetch adds host access (Phase 2). |

### Actions to maintain/raise scores

- **Perf:** profile with a 5k–10k synthetic bookmark set; verify scroll FPS and
  initial flatten time; tune `overscan` / row height if needed.
- **UX:** add favicons (Phase 2), keyboard navigation, and an "expand to match"
  affordance during search.
- **Security:** request `host_permissions` as narrowly as possible (prefer
  optional/on-demand) when metadata fetching lands.

## Technical Debt & TODOs

- Service worker is lifecycle-only; a typed message router + job queue arrive
  with Phase 2/3 background work.
- No icon assets yet (extension uses the default action icon).
- `content/` scripts not created yet — added in Phase 2 for metadata extraction.
- Component-level tests (React Testing Library) deferred; current coverage is on
  pure logic. Add interaction tests when management/DnD (Phase 4) lands.
- Editable working-tree store intentionally omitted in Phase 1 (would be unused);
  introduced in Phase 4.
