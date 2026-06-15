# Changelog

All notable changes to LinkAtlas are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Phase 1: Foundation & Bookmark Vertical Slice

### Added

- Manifest V3 extension scaffold with Vite 7 + CRXJS, React 19, Tailwind CSS 4,
  Zustand, TanStack Query, and TanStack Virtual.
- Bookmark domain model and pure tree utilities (`extractDomain`, `searchTree`,
  `filterByDomain`, `sortTree`, `flattenVisible`, counts) with unit tests.
- Chrome Bookmarks adapter (`getBookmarkRoots`, pure `mapBookmarkNode`).
- Full-page manager (options page) with a virtualized bookmark tree:
  collapse/expand, search (title/URL/domain), domain filter, and sorting by
  original order / title / domain / recently added.
- Popup with live bookmark & folder counts and an "Open Manager" action.
- Settings drawer to select an AI provider and store its API key in
  `chrome.storage.local`.
- AI provider abstraction (`AIProvider`) with a fully implemented OpenAI provider
  using Chat Completions Structured Outputs, plus shared prompt/schema/parsing
  utilities — all unit-tested with an injected `fetch`.
- Documentation: README, ARCHITECTURE, ROADMAP, CHANGELOG.

### Notes

- AI analysis is not yet wired into the UI; metadata collection, category
  management, and apply-to-Chrome are scheduled for later phases (see ROADMAP).
- 28 passing unit tests; `typecheck` and `build` are green.

[0.1.0]: https://github.com/nalbam/linkatlas-extension/releases/tag/v0.1.0
