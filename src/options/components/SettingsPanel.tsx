import { PROVIDER_LABELS, type ProviderId } from '@/ai/types'
import { useSettingsStore } from '@/state/settingsStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'

const PROVIDERS: ProviderId[] = ['openai', 'gemini', 'claude']

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { provider, apiKeys, setProvider, setApiKey } = useSettingsStore()
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[360px] flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">Settings</h2>
          <Button variant="ghost" onClick={onClose} title="Close">
            <Icon name="close" size={18} />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-auto px-5 py-5">
          <section>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              AI provider
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PROVIDERS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProvider(id)}
                  className={`rounded-md border px-2 py-1.5 text-sm transition-colors ${
                    provider === id
                      ? 'border-accent bg-accent/15 text-slate-100'
                      : 'border-border bg-surface-raised text-muted hover:text-slate-100'
                  }`}
                >
                  {PROVIDER_LABELS[id]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label
              htmlFor="api-key"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted"
            >
              {PROVIDER_LABELS[provider]} API key
            </label>
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKeys[provider]}
              onChange={(event) => setApiKey(provider, event.target.value)}
              placeholder={`Paste your ${PROVIDER_LABELS[provider]} key`}
              className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Stored only in this browser via <code>chrome.storage.local</code> — never bundled or
              sent anywhere except directly to {PROVIDER_LABELS[provider]} when you run an analysis.
            </p>
          </section>

          <section className="rounded-md border border-border bg-surface-raised px-3 py-3">
            <p className="text-xs leading-relaxed text-muted">
              AI analysis (summaries, categories, tags) arrives in an upcoming phase. Your key is
              saved now so it's ready when you opt in to analyzing selected bookmarks.
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}
