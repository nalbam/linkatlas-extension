/**
 * MV3 service worker entry.
 *
 * Phase 1 keeps this intentionally thin: lifecycle hooks plus a typed message
 * router scaffold. Write operations (apply-to-Chrome) and long-running jobs
 * (metadata fetch, AI batch analysis) move here in later phases so the UI never
 * blocks and work survives popup/options teardown.
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[LinkAtlas] installed:', details.reason)
})

export {}
