import { clearSnapshot, getSnapshot, setSnapshot } from '@/apply/snapshot'
import { type ApplyAssignment, type ApplySnapshot } from '@/apply/types'
import { type ApplyWorkerMessage } from './messages'

const PERSIST_EVERY = 20

/** Find a same-named subfolder under `parentId`, or create one. */
async function ensureFolder(
  parentId: string,
  title: string,
): Promise<{ id: string; created: boolean }> {
  const children = await chrome.bookmarks.getChildren(parentId)
  const existing = children.find((child) => child.url === undefined && child.title === title)
  if (existing) return { id: existing.id, created: false }
  const node = await chrome.bookmarks.create({ parentId, title })
  return { id: node.id, created: true }
}

/**
 * Ensure a nested folder path exists under `rootId`, creating only the missing
 * segments. Same-named folders (including the user's existing ones) are reused,
 * so only newly-created folder ids are recorded to the snapshot — keeping
 * rollback from ever deleting a folder the user already had.
 */
async function ensurePath(
  rootId: string,
  path: readonly string[],
  snapshot: ApplySnapshot,
  onCreated: () => void,
): Promise<string> {
  let parentId = rootId
  for (const title of path) {
    const folder = await ensureFolder(parentId, title)
    if (folder.created) {
      snapshot.createdFolderIds.push(folder.id)
      onCreated()
    }
    parentId = folder.id
  }
  return parentId
}

/**
 * Apply the organization plan to Chrome: for each assignment, ensure its nested
 * folder path directly under the chosen 大 root, then move its bookmarks in. The
 * original position of every moved bookmark (and every created folder id) is
 * recorded to a snapshot — persisted incrementally — so the whole operation can
 * be rolled back.
 */
export async function runApplyJob(
  assignments: readonly ApplyAssignment[],
  post: (message: ApplyWorkerMessage) => void,
  signal: AbortSignal,
): Promise<void> {
  const snapshot: ApplySnapshot = { moved: [], createdFolderIds: [] }
  const total = assignments.reduce((n, a) => n + a.bookmarkIds.length, 0)
  let created = 0
  let moved = 0
  const persist = () => setSnapshot(snapshot)

  try {
    for (const assignment of assignments) {
      if (signal.aborted) break
      const folderId = await ensurePath(assignment.rootId, assignment.path, snapshot, () => {
        created += 1
      })
      await persist()

      for (const id of assignment.bookmarkIds) {
        if (signal.aborted) break
        const nodes = await chrome.bookmarks.get(id).catch(() => [])
        const node = nodes[0]
        if (!node || node.parentId === undefined || node.index === undefined) continue
        snapshot.moved.push({ id, parentId: node.parentId, index: node.index })
        await chrome.bookmarks.move(id, { parentId: folderId })
        moved += 1
        if (moved % PERSIST_EVERY === 0) {
          await persist()
          post({ type: 'progress', total, done: moved })
        }
      }
    }

    await persist()
    post({ type: 'progress', total, done: moved })
    post({ type: 'done', summary: { categories: assignments.length, created, moved } })
  } catch (error) {
    await persist()
    post({ type: 'error', message: (error as Error).message })
  }
}

/**
 * Undo the most recent apply: move every recorded bookmark back to its original
 * parent/index (reverse order), then remove the folders we created. Bookmark ids
 * are stable across moves, so this restores the prior arrangement.
 */
export async function runRollbackJob(post: (message: ApplyWorkerMessage) => void): Promise<void> {
  const snapshot = await getSnapshot()
  if (!snapshot) {
    post({ type: 'error', message: 'Nothing to roll back.' })
    return
  }

  const total = snapshot.moved.length
  let restored = 0
  try {
    for (const item of [...snapshot.moved].reverse()) {
      try {
        await chrome.bookmarks.move(item.id, { parentId: item.parentId, index: item.index })
      } catch {
        // Bookmark was removed since apply — skip.
      }
      restored += 1
      if (restored % PERSIST_EVERY === 0) post({ type: 'progress', total, done: restored })
    }

    // Deepest folders first (reverse of creation order) so parents are empty when removed.
    for (const folderId of [...snapshot.createdFolderIds].reverse()) {
      try {
        await chrome.bookmarks.remove(folderId)
      } catch {
        try {
          await chrome.bookmarks.removeTree(folderId)
        } catch {
          // Already gone.
        }
      }
    }

    await clearSnapshot()
    post({ type: 'progress', total, done: restored })
    post({ type: 'rolledback', restored })
  } catch (error) {
    post({ type: 'error', message: (error as Error).message })
  }
}
