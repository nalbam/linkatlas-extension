/**
 * MV3 service worker entry.
 *
 * Owns long-running, teardown-surviving work over `chrome.runtime` Ports:
 * - Phase 2: metadata collection (fetch + parse + cache each page).
 * - Phase 3: AI analysis (provider.analyzeBookmark per item, cached).
 */

import { runAnalysisJob } from './analysisJob'
import { runApplyJob, runRollbackJob } from './applyJob'
import {
  ANALYSIS_PORT,
  APPLY_PORT,
  METADATA_PORT,
  type AnalysisClientMessage,
  type ApplyClientMessage,
  type ClientMessage,
} from './messages'
import { runMetadataJob } from './metadataJob'
import { createProvider } from '@/ai/providers'

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[LinkAtlas] installed:', details.reason)
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === METADATA_PORT) handleMetadataPort(port)
  else if (port.name === ANALYSIS_PORT) handleAnalysisPort(port)
  else if (port.name === APPLY_PORT) handleApplyPort(port)
})

function handleMetadataPort(port: chrome.runtime.Port) {
  const controller = new AbortController()
  let started = false

  port.onMessage.addListener((message: ClientMessage) => {
    if (message.type === 'collect') {
      if (started) return
      started = true
      void runMetadataJob(message.urls, (workerMessage) => safePost(port, workerMessage), controller.signal)
    } else if (message.type === 'cancel') {
      controller.abort()
    }
  })
  port.onDisconnect.addListener(() => controller.abort())
}

function handleAnalysisPort(port: chrome.runtime.Port) {
  const controller = new AbortController()
  let started = false

  port.onMessage.addListener((message: AnalysisClientMessage) => {
    if (message.type === 'analyze') {
      if (started) return
      started = true
      const model = message.model ?? ''
      try {
        const provider = createProvider(message.provider, message.apiKey, { model: message.model })
        void runAnalysisJob(
          message.items,
          provider,
          model,
          (workerMessage) => safePost(port, workerMessage),
          controller.signal,
        )
      } catch (error) {
        safePost(port, { type: 'error', message: (error as Error).message })
      }
    } else if (message.type === 'cancel') {
      controller.abort()
    }
  })
  port.onDisconnect.addListener(() => controller.abort())
}

function handleApplyPort(port: chrome.runtime.Port) {
  const controller = new AbortController()
  let started = false

  port.onMessage.addListener((message: ApplyClientMessage) => {
    if (message.type === 'apply') {
      if (started) return
      started = true
      void runApplyJob(
        message.assignments,
        message.target,
        (workerMessage) => safePost(port, workerMessage),
        controller.signal,
      )
    } else if (message.type === 'rollback') {
      if (started) return
      started = true
      void runRollbackJob((workerMessage) => safePost(port, workerMessage))
    } else if (message.type === 'cancel') {
      controller.abort()
    }
  })
  port.onDisconnect.addListener(() => controller.abort())
}

function safePost(port: chrome.runtime.Port, message: unknown) {
  try {
    port.postMessage(message)
  } catch {
    // Port already closed by the client — nothing to do.
  }
}

export {}
