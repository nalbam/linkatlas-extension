import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

// VERSION (repo root) is the single source of truth for the released version;
// the release workflow triggers on changes to it. See README "Releases".
const version = readFileSync(fileURLToPath(new URL('../VERSION', import.meta.url)), 'utf8').trim()

// Single source of truth for the MV3 manifest. CRXJS resolves the referenced
// HTML / TS entry points and rewrites them to built asset paths.
export default defineManifest({
  manifest_version: 3,
  name: 'LinkAtlas',
  version,
  description: pkg.description,
  // Read & (later) reorganize bookmarks; persist settings + metadata cache.
  permissions: ['bookmarks', 'storage'],
  // All host access is opt-in, requested at runtime from a user gesture:
  // - <all_urls>: page fetching for metadata ("Collect metadata").
  // - api.openai.com: direct AI analysis calls ("Analyze").
  optional_host_permissions: ['<all_urls>', 'https://api.openai.com/*'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'LinkAtlas',
  },
  // The full-page manager lives on the options page (opened in its own tab).
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
})
