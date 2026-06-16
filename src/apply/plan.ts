import { UNCATEGORIZED } from '@/organize/operations'
import { pathKey } from '@/organize/path'
import { type PathTreeNode, type RootTreeNode } from '@/organize/types'
import { type ApplyAssignment, type ApplyPlan } from './types'

/**
 * Build the apply preview by walking the 大 root forest. Every 中/小 node that
 * holds bookmarks becomes one assignment (its root id + full path → its bookmark
 * ids); Uncategorized and empty nodes are skipped. `foldersToCreate` is an upper
 * bound — distinct (rootId + path-prefix) count — since `ensureFolder` reuses
 * same-named folders at apply time.
 */
export function buildApplyPlan(forest: readonly RootTreeNode[]): ApplyPlan {
  const assignments: ApplyAssignment[] = []

  for (const root of forest) {
    const walk = (nodes: readonly PathTreeNode[]) => {
      for (const node of nodes) {
        if (node.path[0] !== UNCATEGORIZED && node.bookmarks.length > 0) {
          assignments.push({
            rootId: root.rootId,
            path: node.path,
            bookmarkIds: node.bookmarks.map((b) => b.id),
          })
        }
        walk(node.children)
      }
    }
    walk(root.children)
  }

  const folderKeys = new Set<string>()
  for (const assignment of assignments) {
    for (let depth = 1; depth <= assignment.path.length; depth++) {
      folderKeys.add(pathKey([assignment.rootId, ...assignment.path.slice(0, depth)]))
    }
  }

  const bookmarksToMove = assignments.reduce((sum, a) => sum + a.bookmarkIds.length, 0)
  return { assignments, foldersToCreate: folderKeys.size, bookmarksToMove }
}
