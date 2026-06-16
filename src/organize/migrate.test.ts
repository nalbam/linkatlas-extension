import { describe, expect, it } from 'vitest'
import { migrateOrganize } from './migrate'
import { EMPTY_ORGANIZE } from './operations'

describe('migrateOrganize', () => {
  it('upgrades v1 flat categories to v3 single-segment paths', () => {
    const v1 = { overrides: { u: 'Dev', v: 'Games' }, extraCategories: ['Empty'] }
    expect(migrateOrganize(v1)).toEqual({
      version: 3,
      overrides: { u: ['Dev'], v: ['Games'] },
      rootOverrides: {},
      extraPaths: [['Empty']],
      purposeRoots: [],
    })
  })

  it('upgrades a v2 state by adding empty rootOverrides', () => {
    const v2 = { version: 2, overrides: { u: ['A', 'B'] }, extraPaths: [['X']], purposeRoots: ['karrot'] }
    expect(migrateOrganize(v2)).toEqual({
      version: 3,
      overrides: { u: ['A', 'B'] },
      rootOverrides: {},
      extraPaths: [['X']],
      purposeRoots: ['karrot'],
    })
  })

  it('returns a v3 state unchanged', () => {
    const v3 = {
      version: 3 as const,
      overrides: {},
      rootOverrides: { u: 'Other Bookmarks' },
      extraPaths: [],
      purposeRoots: [],
    }
    expect(migrateOrganize(v3)).toEqual(v3)
  })

  it('handles empty / undefined input', () => {
    expect(migrateOrganize(undefined)).toEqual(EMPTY_ORGANIZE)
    expect(migrateOrganize({})).toEqual(EMPTY_ORGANIZE)
  })
})
