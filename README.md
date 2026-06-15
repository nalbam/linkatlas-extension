# LinkAtlas — AI Bookmark Organizer

LinkAtlas is a Chrome extension (Manifest V3) that turns a messy bookmark
collection into an intelligent, searchable knowledge system. It reads your
Chrome bookmarks, visualizes them as a fast virtualized tree, and (in upcoming
phases) uses pluggable LLM providers to summarize, categorize, tag, and
reorganize them — all locally driven, with your API key, on your machine.

> **Status — Phase 2 (metadata collection).** Read, visualize, search, filter,
> and sort your real bookmarks, and collect per-page metadata (favicon,
> description, OpenGraph, keywords) on demand. AI analysis, category management,
> and apply-to-Chrome land in later phases — see [ROADMAP.md](./ROADMAP.md).

## Features

- **Read the full Chrome bookmark tree** via the Bookmarks API, preserving the
  original folder hierarchy and order.
- **Virtualized tree view** that stays smooth at 10k+ nodes (only visible rows
  are mounted).
- **Search** across bookmark title, URL, and domain — matching paths auto-expand.
- **Filter by domain** and **sort** (original order, title, domain, recently added).
- **Collapse / expand** folders individually or all at once.
- **Metadata collection** — fetch each page's favicon, title, description,
  OpenGraph, and keywords with batching, rate limiting, timeouts, and an
  incremental cache. Favicons and descriptions render inline in the tree.
- **Popup** with quick bookmark/folder counts and a one-click "Open Manager".
- **Settings** for choosing an AI provider and storing its API key locally
  (`chrome.storage.local`) — ready for the analysis phase.
- **Pluggable AI abstraction** with a fully implemented OpenAI provider
  (Structured Outputs).

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
├─ background/   MV3 service worker: metadata job + typed Port messages
├─ popup/        Toolbar popup: stats + "Open Manager"
├─ options/      Full-page manager app (tree, toolbar, metadata bar, settings)
│  ├─ components/  BookmarkTreeView, Toolbar, MetadataBar, SettingsPanel
│  └─ hooks/       useBookmarkTree, useDebouncedValue
├─ services/     Framework-agnostic data access (bookmarkService)
├─ ai/           Provider abstraction + OpenAI implementation + prompts
├─ bookmarks/    Domain model + Chrome adapter + pure tree utilities
├─ metadata/     Pure HTML parser + resilient fetcher + cache + types
├─ state/        Zustand stores (ui, settings, metadata) + pure selectors
├─ ui/           Reusable presentational components
└─ utils/        Query client, chrome.storage adapter, batch runner
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layering and data flow, and
[CHANGELOG.md](./CHANGELOG.md) for release notes.

## Privacy

LinkAtlas never transmits your bookmarks anywhere on its own. API keys are stored
only in `chrome.storage.local`.

**Metadata collection is opt-in.** The extension ships with no host access; the
`<all_urls>` permission is `optional` and requested only when you click "Collect
metadata", via Chrome's own consent prompt. Fetches use `credentials: 'omit'`,
and results are cached locally. When AI analysis ships, sending data to a
provider will likewise be explicit and scoped (selected / folder / all) with a
token-cost estimate shown first — see the Privacy section of the roadmap.
