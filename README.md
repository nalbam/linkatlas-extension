# LinkAtlas — AI Bookmark Organizer

LinkAtlas is a Chrome extension (Manifest V3) that turns a messy bookmark
collection into an intelligent, searchable knowledge system. It reads your
Chrome bookmarks, visualizes them as a fast virtualized tree, and (in upcoming
phases) uses pluggable LLM providers to summarize, categorize, tag, and
reorganize them — all locally driven, with your API key, on your machine.

> **Status — Phase 4 (category management).** Read, visualize, search, filter,
> and sort your real bookmarks; collect per-page metadata; analyze with AI; and
> reorganize bookmarks into categories (create / rename / merge / delete, drag &
> drop, undo) in a local working plan. Applying that plan back to Chrome is the
> final phase — see [ROADMAP.md](./ROADMAP.md).

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
- **AI analysis** — generate `{summary, category, subcategory, tags, importance,
  reason}` per bookmark via a pluggable provider (OpenAI implemented). A
  cost/consent gate shows the scope, token estimate, and approximate cost before
  anything is sent; results overlay as importance badges + category chips, with a
  tag-statistics drawer.
- **Category management** (Organize view) — reorganize bookmarks into categories
  with create / rename / merge / delete, drag-and-drop or multi-select move, and
  undo. Edits a local working plan only; Chrome bookmarks stay untouched until
  the apply phase.
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
├─ background/   MV3 service worker: metadata + analysis jobs over typed Ports
├─ popup/        Toolbar popup: stats + "Open Manager"
├─ options/      Full-page manager app (Tree + Organize views)
│  ├─ components/  BookmarkTreeView, Toolbar, MetadataBar, AnalysisBar,
│  │               AnalyzeDialog, TagStatsPanel, OrganizeView, CategorySection,
│  │               SettingsPanel
│  └─ hooks/       useBookmarkTree, useDebouncedValue
├─ services/     Framework-agnostic data access (bookmarkService)
├─ ai/           Provider abstraction + OpenAI implementation + prompts
├─ analysis/     Pure analyze-input + token/cost estimate + cache + types
├─ organize/     Pure category reducers + grouping + types
├─ bookmarks/    Domain model + Chrome adapter + pure tree utilities
├─ metadata/     Pure HTML parser + resilient fetcher + cache + types
├─ state/        Zustand stores (ui, settings, metadata, analysis, organize)
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
