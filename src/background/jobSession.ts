/**
 * Live job presence mirrored to `chrome.storage.session`, so a reloaded options
 * page can detect a job still running in the worker and re-subscribe to it. Only
 * presence + coarse totals are stored; the precise live progress is replayed from
 * the worker's in-memory `lastProgress` on re-attach. Session storage is cleared
 * when the browser closes, which is exactly the lifetime a running job has.
 */

export interface JobSessionEntry {
  running: boolean
  total: number
  done: number
}

const PREFIX = 'job:'

export async function setJobSession(portName: string, entry: JobSessionEntry): Promise<void> {
  await chrome.storage.session.set({ [PREFIX + portName]: entry })
}

export async function getJobSession(portName: string): Promise<JobSessionEntry | null> {
  const key = PREFIX + portName
  const result = await chrome.storage.session.get(key)
  return (result[key] as JobSessionEntry | undefined) ?? null
}

export async function clearJobSession(portName: string): Promise<void> {
  await chrome.storage.session.remove(PREFIX + portName)
}
