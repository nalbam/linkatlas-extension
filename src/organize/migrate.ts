import { type OrganizeState } from './types'

/** The pre-path (v1) persisted shape: flat single-string categories. */
interface LegacyOrganize {
  overrides?: Record<string, string>
  extraCategories?: string[]
}

/**
 * Migrate a persisted organize state to the current v4 path shape:
 * - v1 (flat string categories) → single-segment paths.
 * - v2 (paths, no 大 layer) → add an empty `rootOverrides` (bookmarks keep their
 *   original 大 until moved).
 * - v3 (URL-keyed overrides/rootOverrides) → drop placement overrides because
 *   they cannot be safely mapped to bookmark ids without the live tree.
 * `purposeRoots: []` on a v1 upgrade signals "not yet seeded" so the bookmark-bar
 * folders get auto-detected on first organize render.
 */
export function migrateOrganize(persisted: unknown): OrganizeState {
  const obj = (persisted ?? {}) as Record<string, unknown>

  if (obj.version === 4) return persisted as OrganizeState

  if (obj.version === 3) {
    return {
      version: 4,
      overrides: {},
      rootOverrides: {},
      extraPaths: (obj.extraPaths as string[][]) ?? [],
      purposeRoots: (obj.purposeRoots as string[]) ?? [],
    }
  }

  if (obj.version === 2) {
    return {
      version: 4,
      overrides: {},
      rootOverrides: {},
      extraPaths: (obj.extraPaths as string[][]) ?? [],
      purposeRoots: (obj.purposeRoots as string[]) ?? [],
    }
  }

  const old = obj as LegacyOrganize
  return {
    version: 4,
    overrides: {},
    rootOverrides: {},
    extraPaths: (old.extraCategories ?? []).map((category) => [category]),
    purposeRoots: [],
  }
}
