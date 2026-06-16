# LinkAtlas — AI Bookmark Organizer

LinkAtlas is a Chrome extension (Manifest V3) that turns a messy bookmark
collection into an organized one. It reads your Chrome bookmarks, fetches each
page and uses a pluggable LLM to analyze what the site is, then asks the LLM to
re-cluster the whole collection into a small category hierarchy — which you can
edit and apply back to Chrome. All locally driven, with your API key, on your
machine.

> **Status — core loop complete.** End-to-end:
> ① read bookmarks → ② fetch each page + analyze the site with an LLM →
> ③ the LLM **re-clusters** the collection into a category hierarchy →
> ④ **edit** categories → ⑤ **apply to Chrome** (with **rollback**).
> See [ROADMAP.md](./ROADMAP.md).

## Features

- **Read the full Chrome bookmark tree** via the Bookmarks API, preserving the
  original folder hierarchy and order.
- **Virtualized tree view** that stays smooth at 10k+ nodes (only visible rows
  are mounted).
- **Search** across bookmark title, URL, and domain — matching paths auto-expand.
- **Filter** by domain, AI category, or AI tag; **sort** by original order, title,
  domain, recently added, or **importance**.
- **Collapse / expand** folders individually or all at once.
- **Metadata collection** — fetch each page's favicon, title, description,
  OpenGraph, and keywords with batching, rate limiting, timeouts, and an
  incremental cache. Favicons and descriptions render inline in the tree.
- **AI analysis** — fetch a page's signals, then have a pluggable LLM (OpenAI
  implemented) analyze the site into `{summary, category, subcategory, tags,
  importance, reason}` per bookmark. A cost/consent gate shows scope, token
  estimate, and approximate cost before anything is sent; results overlay as
  importance badges + category chips, with a tag-statistics drawer.
- **AI recategorize (collection-aware)** — send the whole collection to the LLM in
  one call so it groups similar sites into a small, consistent set of categories
  (~8–12 top-level, a 2nd level only for large groups), instead of per-bookmark
  labels that drift apart. The bookmark bar and purpose groups are left out
  (managed manually); results update each bookmark's category and flow into the
  organize tree. Failures are surfaced in the UI.
- **Organize view** — edit the category tree directly. The browser roots
  (북마크바 / 기타 북마크) show as read-only **大** nodes, with a **대/중/소** path
  hierarchy under each. **Purpose groups** (your own folders, e.g. a company or
  personal folder) are preserved as-is and skip AI classification; everything else
  is grouped by AI category. Drag bookmarks or folders (across roots too), rename /
  merge / delete / create, toggle purpose↔category — with **undo** and a **reset**
  that clears edits + AI classification back to the original folders. Expand/collapse
  state persists across reloads. Edits a local working plan only.
- **Apply to Chrome** — materialize the plan as real bookmark folders behind a
  preview + confirm gate: each bookmark's path is created under its assigned root
  (북마크바 / 기타 북마크), reusing existing same-named folders. Post-apply summary +
  **one-click rollback** that removes only the folders this apply created, so the
  undo is complete.
- **Popup** with quick bookmark/folder counts and a one-click "Open Manager".
- **Settings** for choosing an AI provider and storing its API key locally
  (`chrome.storage.local`).

## Tech Stack

TypeScript · React 19 · Vite 7 · [CRXJS](https://crxjs.dev) (MV3) · Tailwind CSS 4 ·
Zustand · TanStack Query · TanStack Virtual · Vitest.

## Getting Started

```bash
npm install
npm run dev      # Vite dev server with HMR for the extension
npm run build    # Production build into dist/
```

### Load the extension in Chrome

1. `npm run build`
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the generated `dist/` folder.
4. Open the LinkAtlas popup and click **Open Manager**, or open the extension's
   options page — both surfaces read your real bookmarks.

> During development you can `npm run dev` and load `dist/` once; CRXJS keeps it
> updated with HMR.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server (HMR). |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Preview the production build. |
| `npm run typecheck` | `tsc --noEmit` type checking. |
| `npm test` | Run the Vitest unit suite once. |
| `npm run test:watch` | Vitest in watch mode. |

## Project Structure

```
src/
├─ background/   MV3 service worker: metadata + analysis + recategorize + apply jobs over typed Ports
├─ popup/        Toolbar popup: stats + "Open Manager"
├─ options/      Full-page manager app (Tree + Organize views)
│  ├─ components/  BookmarkTreeView, Toolbar, MetadataBar, AnalysisBar,
│  │               AnalyzeDialog, TagStatsPanel, OrganizeView, RootSection,
│  │               CategorySection, ApplyDialog, SettingsPanel
│  └─ hooks/       useBookmarkTree, useDebouncedValue
├─ services/     Framework-agnostic data access (bookmarkService)
├─ ai/           Provider abstraction + OpenAI (analyze + recategorize) + prompts
├─ analysis/     Pure analyze-input + recategorize + token/cost estimate + cache + types
├─ organize/     Pure path-based grouping + reducers (大/中/小, purpose vs category) + migrate + types
├─ apply/        Pure apply planner + snapshot + types
├─ bookmarks/    Domain model + Chrome adapter + pure tree utilities
├─ metadata/     Pure HTML parser + resilient fetcher + cache + types
├─ state/        Zustand stores (ui, settings, metadata, analysis, organize, apply)
├─ ui/           Reusable presentational components
└─ utils/        Query client, chrome.storage adapter, batch runner
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layering and data flow, and
[CHANGELOG.md](./CHANGELOG.md) for release notes.

## Releases

The released version lives in the `VERSION` file (single source of truth — the
MV3 manifest reads it at build time). Pushing a change to `VERSION` on `main`
triggers the [`release`](.github/workflows/release.yml) workflow, which:

1. installs deps, runs `typecheck` + tests,
2. runs [`package.sh`](./package.sh) to build and zip `dist/` into
   `release/<repo>-<version>.zip`, and
3. publishes a GitHub Release tagged `v<version>` with the zip attached.

To cut a release: bump `VERSION` (e.g. `0.4.0` → `0.5.0`), keep `package.json`
in sync, and push to `main`. To build a package locally:

```bash
npm install && bash ./package.sh   # → release/linkatlas-extension-<version>.zip
```

The zip has `manifest.json` at its root, so it loads directly via **Load
unpacked** (after unzip) or uploads straight to the Chrome Web Store.

## Privacy

LinkAtlas never transmits your bookmarks anywhere on its own. API keys are stored
only in `chrome.storage.local`.

**All network access is opt-in.** The extension ships with no host access; host
permissions are `optional` and requested via Chrome's own consent prompt only
when you act:

- **Metadata** — `<all_urls>` is requested on "Collect metadata"; fetches use
  `credentials: 'omit'` and results are cached locally.
- **AI analysis** — `api.openai.com` is requested on confirm. Before any send,
  the Analyze dialog shows the exact scope (which bookmarks), an estimated token
  count, and an approximate cost; nothing leaves the browser until you confirm.
  Scope follows your active filters, so you can analyze just a subset.
