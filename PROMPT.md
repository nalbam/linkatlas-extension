# LinkAtlas Chrome Extension Development Prompt

You are a senior software architect and staff engineer.

Your mission is to build a production-quality Chrome Extension called **LinkAtlas**.

LinkAtlas is an AI-powered bookmark organizer that helps users understand, classify, search, and reorganize their Chrome bookmarks using LLMs.

You must use a **Self-Evaluating Loop**.

---

## Self-Evaluating Loop

For every task:

1. Analyze requirements
2. Create implementation plan
3. Implement
4. Run validation
5. Evaluate quality
6. Identify weaknesses
7. Improve implementation
8. Repeat until quality target is met

After each iteration generate:

```text
Progress Report
- What was built
- What works
- What is missing
- Technical debt
- Next improvements
```

Never stop after a single implementation pass.

Always improve architecture, UX, maintainability, and performance.

---

# Product Vision

Users have thousands of bookmarks.

Current bookmark folders become:

* messy
* duplicated
* outdated
* difficult to search

LinkAtlas transforms bookmarks into an intelligent knowledge system.

Users should be able to:

* import bookmarks
* analyze websites
* generate tags
* generate categories
* reorganize bookmarks
* edit categories
* move bookmarks
* visualize bookmark tree
* apply changes back to Chrome

---

# MVP Scope

Implement the following features.

## 1. Read Chrome Bookmarks

Use Chrome Bookmarks API.

Requirements:

* load entire bookmark tree
* load folders
* load bookmark items
* preserve original hierarchy
* support thousands of bookmarks

Display:

```text
Folder
 ├ Bookmark
 ├ Bookmark
 └ Folder
```

---

## 2. URL Metadata Collection

For each bookmark:

Collect:

* title
* domain
* favicon
* description
* OpenGraph data

If accessible:

* page summary
* page keywords

Handle:

* redirects
* failures
* timeouts
* invalid URLs

Implement batching.

Implement rate limiting.

---

## 3. OpenAI Analysis

For every bookmark generate:

```json
{
  "summary": "",
  "category": "",
  "subcategory": "",
  "tags": [],
  "importance": 0,
  "reason": ""
}
```

Categories should be inferred automatically.

Examples:

Development
AI
Productivity
Business
Finance
Learning
Shopping
Travel
News
Entertainment

Do not hardcode categories.

Allow AI-generated categories.

---

## 4. Tag Generation

Generate:

* semantic tags
* technology tags
* topic tags

Examples:

```text
React
Kubernetes
AWS
AI Agent
Startup
Product Design
```

Deduplicate tags.

Create tag statistics.

---

## 5. Category Management

User must be able to:

* rename category
* merge categories
* split categories
* create category
* delete category

Drag-and-drop support preferred.

All changes should update local state immediately.

---

## 6. Tree Visualization

Display bookmarks as:

```text
Category
 ├ Folder
 │  ├ Bookmark
 │  └ Bookmark
 └ Folder
```

Requirements:

* collapse/expand
* search
* filter by tag
* filter by category
* sort by domain
* sort by importance

Support thousands of nodes.

Use virtualization.

---

## 7. Apply Changes To Chrome

Use Chrome Bookmarks API.

Support:

* create folders
* rename folders
* move bookmarks
* delete folders
* reorganize hierarchy

Before apply:

Show preview.

After apply:

Show summary.

Example:

```text
Moved: 152 bookmarks
Created: 12 folders
Merged: 8 categories
Deleted: 3 empty folders
```

Implement rollback support.

---

# Technical Requirements

## Stack

* TypeScript
* React
* Vite
* Chrome Extension Manifest V3
* Tailwind
* Zustand
* TanStack Query

---

## Architecture

Use:

```text
src/
 ├ background/
 ├ content/
 ├ popup/
 ├ options/
 ├ services/
 ├ ai/
 ├ bookmarks/
 ├ ui/
 ├ state/
 └ utils/
```

Follow:

* SOLID
* Clean Architecture
* Feature Isolation

No large monolithic files.

---

# AI Design

AI provider abstraction required.

Implement:

```typescript
interface AIProvider {
  analyzeBookmark(): Promise<BookmarkAnalysis>
}
```

Providers:

* OpenAI
* Gemini
* Claude

Future providers must be pluggable.

---

# Privacy

Never send bookmark tree without explicit user approval.

Allow:

```text
Analyze selected bookmarks
Analyze folder
Analyze all bookmarks
```

Display estimated token cost before sending.

---

# Performance Goals

Bookmark Count:

* 100
* 1000
* 5000
* 10000

must remain usable.

Use:

* caching
* batching
* incremental analysis
* virtualization

---

# Quality Gates

Before each release evaluate:

## Architecture Score

0-10

## UX Score

0-10

## Performance Score

0-10

## Maintainability Score

0-10

## Security Score

0-10

If any score is below 8:

DO NOT STOP.

Create improvement plan and continue iterating.

---

# Deliverables

Always keep these files updated:

```text
README.md
ARCHITECTURE.md
ROADMAP.md
CHANGELOG.md
```

Generate screenshots and diagrams when useful.

Generate TODOs automatically.

Track technical debt.

---

# Success Criteria

A user can:

1. Read Chrome bookmarks
2. Analyze bookmarks using AI
3. Generate categories
4. Generate tags
5. Reorganize bookmarks
6. Preview changes
7. Apply changes back to Chrome

without leaving the extension.

Continue iterating until all success criteria are satisfied.
