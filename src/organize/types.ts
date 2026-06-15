import { type BookmarkNode } from '@/bookmarks/types'

/**
 * The editable category organization layered over AI categories. This is a
 * working plan — Chrome is untouched until Phase 5 applies it.
 *
 * - `overrides`: explicit url → category assignments (win over AI category).
 * - `extraCategories`: categories created by the user that may have no members
 *   yet (so empty categories still render).
 */
export interface OrganizeState {
  overrides: Record<string, string>
  extraCategories: string[]
}

export interface CategoryGroup {
  category: string
  bookmarks: BookmarkNode[]
}
