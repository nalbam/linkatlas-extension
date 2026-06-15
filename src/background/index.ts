/**
 * MV3 service worker entry.
 *
 * Owns long-running, teardown-surviving work. Phase 2 adds the metadata
 * collection job: the options page connects over a Port, requests a `collect`,
 * and the worker fetches + caches each page's metadata while streaming progress.
 */

import { METADATA_PORT, type ClientMessage } from './messages'
import { runMetadataJob } from './metadataJob'

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[LinkAtlas] installed:', details.reason)
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== METADATA_PORT) return

  const controller = new AbortController()
  let started = false

  port.onMessage.addListener((message: ClientMessage) => {
    if (message.type === 'collect') {
      if (started) return
      started = true
      void runMetadataJob(message.urls, (workerMessage) => {
        try {
          port.postMessage(workerMessage)
        } catch {
          // Port already closed by the client — nothing to do.
        }
      }, controller.signal)
    } else if (message.type === 'cancel') {
      controller.abort()
    }
  })

  port.onDisconnect.addListener(() => controller.abort())
})

export {}
