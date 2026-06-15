import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

// Single source of truth for the MV3 manifest. CRXJS resolves the referenced
// HTML / TS entry points and rewrites them to built asset paths.
export default defineManifest({
  manifest_version: 3,
  name: 'LinkAtlas',
  version: pkg.version,
  description: pkg.description,
  // Read & (later) reorganize bookmarks; persist settings + analysis cache.
  permissions: ['bookmarks', 'storage'],
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
