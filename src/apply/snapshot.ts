import { type ApplySnapshot } from './types'

/** Single-slot rollback snapshot in `chrome.storage.local` (last apply only). */

const KEY = 'apply:snapshot'

export async function getSnapshot(): Promise<ApplySnapshot | null> {
  const result = await chrome.storage.local.get(KEY)
  return (result[KEY] as ApplySnapshot | undefined) ?? null
}

export async function setSnapshot(snapshot: ApplySnapshot): Promise<void> {
  await chrome.storage.local.set({ [KEY]: snapshot })
}

export async function clearSnapshot(): Promise<void> {
  await chrome.storage.local.remove(KEY)
}
