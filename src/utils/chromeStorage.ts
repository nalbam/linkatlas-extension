import { type StateStorage } from 'zustand/middleware'

/**
 * Zustand persistence adapter backed by `chrome.storage.local`. Values are
 * plain strings (Zustand's `createJSONStorage` handles (de)serialization), so
 * this just shuttles strings in and out of extension storage.
 */
export const chromeStorageAdapter: StateStorage = {
  getItem: async (name) => {
    const result = await chrome.storage.local.get(name)
    return (result[name] as string | undefined) ?? null
  },
  setItem: async (name, value) => {
    await chrome.storage.local.set({ [name]: value })
  },
  removeItem: async (name) => {
    await chrome.storage.local.remove(name)
  },
}
