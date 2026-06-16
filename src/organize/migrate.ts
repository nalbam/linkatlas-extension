import { type OrganizeState } from './types'

/** The pre-path (v1) persisted shape: flat single-string categories. */
interface LegacyOrganize {
  overrides?: Record<string, string>
  extraCategories?: string[]
}

/**
 * Migrate a persisted organize state to the current v3 path shape:
 * - v1 (flat string categories) → single-segment paths.
 * - v2 (paths, no 大 layer) → add an empty `rootOverrides` (bookmarks keep their
 *   original 大 until moved).
 * `purposeRoots: []` on a v1 upgrade signals "not yet seeded" so the bookmark-bar
 * folders get auto-detected on first organize render.
 */
export function migrateOrganize(persisted: unknown): OrganizeState {
  const obj = (persisted ?? {}) as Record<string, unknown>

  if (obj.version === 3) return persisted as OrganizeState

  if (obj.version === 2) {
    return {
      version: 3,
      overrides: (obj.overrides as Record<string, string[]>) ?? {},
      rootOverrides: {},
      extraPaths: (obj.extraPaths as string[][]) ?? [],
      purposeRoots: (obj.purposeRoots as string[]) ?? [],
    }
  }

  const old = obj as LegacyOrganize
  const overrides: Record<string, string[]> = {}
  for (const [url, value] of Object.entries(old.overrides ?? {})) {
    overrides[url] = Array.isArray(value) ? (value as string[]) : [String(value)]
  }
  return {
    version: 3,
    overrides,
    rootOverrides: {},
    extraPaths: (old.extraCategories ?? []).map((category) => [category]),
    purposeRoots: [],
  }
}
