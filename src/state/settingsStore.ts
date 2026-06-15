import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type ProviderId } from '@/ai/types'
import { chromeStorageAdapter } from '@/utils/chromeStorage'

/**
 * Persistent user settings (provider choice + API keys). Keys live only in
 * `chrome.storage.local` on the user's machine — never bundled, never synced to
 * a server. Hydration is async; `hasHydrated` lets the UI avoid flashing empty
 * fields before storage loads.
 */
interface SettingsState {
  provider: ProviderId
  apiKeys: Record<ProviderId, string>
  hasHydrated: boolean

  setProvider: (provider: ProviderId) => void
  setApiKey: (provider: ProviderId, key: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: 'openai',
      apiKeys: { openai: '', gemini: '', claude: '' },
      hasHydrated: false,

      setProvider: (provider) => set({ provider }),
      setApiKey: (provider, key) =>
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
    }),
    {
      name: 'linkatlas-settings',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: ({ provider, apiKeys }) => ({ provider, apiKeys }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
