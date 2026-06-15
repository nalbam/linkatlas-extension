/**
 * Thin adapter over `chrome.bookmarks`. The recursive mapper is exported
 * separately (and pure) so it can be unit-tested without a Chrome runtime.
 */

import { type TreeNode } from './types'
import { extractDomain } from './tree'

type RawNode = chrome.bookmarks.BookmarkTreeNode

/** Map one raw Chrome node (and its subtree) into the domain model. */
export function mapBookmarkNode(raw: RawNode): TreeNode {
  if (typeof raw.url === 'string') {
    return {
      type: 'bookmark',
      id: raw.id,
      parentId: raw.parentId,
      title: raw.title,
      index: raw.index ?? 0,
      dateAdded: raw.dateAdded,
      url: raw.url,
      domain: extractDomain(raw.url),
    }
  }
  return {
    type: 'folder',
    id: raw.id,
    parentId: raw.parentId,
    title: raw.title,
    index: raw.index ?? 0,
    dateAdded: raw.dateAdded,
    dateGroupModified: raw.dateGroupModified,
    children: (raw.children ?? []).map(mapBookmarkNode),
  }
}

/**
 * `chrome.bookmarks.getTree()` returns a single synthetic root (id "0") whose
 * children are the top-level folders (Bookmarks Bar, Other Bookmarks, …). We
 * drop the synthetic root and return its children as the visible forest.
 */
export async function getBookmarkRoots(): Promise<TreeNode[]> {
  const tree = await chrome.bookmarks.getTree()
  return tree.flatMap((root) => root.children ?? []).map(mapBookmarkNode)
}
