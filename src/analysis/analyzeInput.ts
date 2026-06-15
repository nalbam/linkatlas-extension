import { type AnalyzeInput } from '@/ai/types'
import { type BookmarkNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'

/**
 * Build the signal sent to the model for one bookmark, enriching the bookmark's
 * own title/url/domain with any Phase 2 metadata (description, keywords). Pure
 * so it can be tested and reused on both the UI and worker sides.
 */
export function buildAnalyzeInput(
  bookmark: BookmarkNode,
  metadata?: BookmarkMetadata,
): AnalyzeInput {
  const description = metadata?.description ?? metadata?.ogDescription
  const keywords = metadata?.keywords && metadata.keywords.length > 0 ? metadata.keywords : undefined
  return {
    title: bookmark.title || metadata?.title || metadata?.ogTitle || '',
    url: bookmark.url,
    domain: bookmark.domain,
    description: description || undefined,
    keywords,
  }
}
