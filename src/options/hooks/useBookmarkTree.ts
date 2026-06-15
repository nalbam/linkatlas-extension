import { useQuery } from '@tanstack/react-query'
import { bookmarkKeys, loadBookmarkTree } from '@/services/bookmarkService'

/** Loads the Chrome bookmark forest into the manager UI. */
export function useBookmarkTree() {
  return useQuery({
    queryKey: bookmarkKeys.tree,
    queryFn: loadBookmarkTree,
  })
}
