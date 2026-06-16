import { describe, expect, it } from 'vitest'
import { migrateOrganize } from './migrate'
import { EMPTY_ORGANIZE } from './operations'

describe('migrateOrganize', () => {
  it('upgrades v1 flat categories to v4 and drops URL-keyed overrides', () => {
    const v1 = { overrides: { u: 'Dev', v: 'Games' }, extraCategories: ['Empty'] }
    expect(migrateOrganize(v1)).toEqual({
      version: 4,
      overrides: {},
      rootOverrides: {},
      extraPaths: [['Empty']],
      purposeRoots: [],
    })
  })

  it('upgrades a v2 state and drops URL-keyed overrides', () => {
    const v2 = { version: 2, overrides: { u: ['A', 'B'] }, extraPaths: [['X']], purposeRoots: ['karrot'] }
    expect(migrateOrganize(v2)).toEqual({
      version: 4,
      overrides: {},
      rootOverrides: {},
      extraPaths: [['X']],
      purposeRoots: ['karrot'],
    })
  })

  it('upgrades a v3 state and drops URL-keyed placement overrides', () => {
    const v3 = {
      version: 3 as const,
      overrides: { u: ['A'] },
      rootOverrides: { u: 'Other Bookmarks' },
      extraPaths: [['X']],
      purposeRoots: ['karrot'],
    }
    expect(migrateOrganize(v3)).toEqual({
      version: 4,
      overrides: {},
      rootOverrides: {},
      extraPaths: [['X']],
      purposeRoots: ['karrot'],
    })
  })

  it('returns a v4 state unchanged', () => {
    const v4 = {
      version: 4 as const,
      overrides: { b1: ['A'] },
      rootOverrides: { b1: 'Other Bookmarks' },
      extraPaths: [],
      purposeRoots: [],
    }
    expect(migrateOrganize(v4)).toEqual(v4)
  })

  it('handles empty / undefined input', () => {
    expect(migrateOrganize(undefined)).toEqual(EMPTY_ORGANIZE)
    expect(migrateOrganize({})).toEqual(EMPTY_ORGANIZE)
  })
})
