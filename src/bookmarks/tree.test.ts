import { describe, expect, it } from 'vitest'
import {
  collectBookmarkUrls,
  collectDomains,
  collectFolderIds,
  collectOriginalPaths,
  collectRootTitleByUrl,
  countTree,
  extractDomain,
  filterByDomain,
  flattenVisible,
  searchTree,
  sortTree,
  topLevelFolderTitles,
} from './tree'
import { type BookmarkNode, type FolderNode, type TreeNode } from './types'

function bookmark(id: string, title: string, url: string, index = 0): BookmarkNode {
  return {
    type: 'bookmark',
    id,
    title,
    index,
    url,
    domain: extractDomain(url),
  }
}

function folder(id: string, title: string, children: TreeNode[], index = 0): FolderNode {
  return { type: 'folder', id, title, index, children }
}

// Bookmarks Bar
//  ├ Dev (folder)
//  │  ├ React docs        (react.dev)
//  │  └ AWS console       (aws.amazon.com)
//  └ Hacker News          (news.ycombinator.com)
function sampleTree(): TreeNode[] {
  return [
    folder('bar', 'Bookmarks Bar', [
      folder('dev', 'Dev', [
        bookmark('b1', 'React docs', 'https://react.dev/learn', 0),
        bookmark('b2', 'AWS console', 'https://aws.amazon.com/console', 1),
      ]),
      bookmark('b3', 'Hacker News', 'https://news.ycombinator.com', 1),
    ]),
  ]
}

describe('extractDomain', () => {
  it('strips www and lowercases', () => {
    expect(extractDomain('https://WWW.Example.com/path')).toBe('example.com')
  })
  it('returns empty string for invalid urls', () => {
    expect(extractDomain('not a url')).toBe('')
  })
})

describe('countTree', () => {
  it('counts folders and bookmarks recursively', () => {
    expect(countTree(sampleTree())).toEqual({ folders: 2, bookmarks: 3 })
  })
})

describe('collectDomains', () => {
  it('returns unique sorted domains', () => {
    expect(collectDomains(sampleTree())).toEqual([
      'aws.amazon.com',
      'news.ycombinator.com',
      'react.dev',
    ])
  })
})

describe('collectBookmarkUrls', () => {
  it('returns unique bookmark URLs across the tree', () => {
    expect(collectBookmarkUrls(sampleTree())).toEqual([
      'https://react.dev/learn',
      'https://aws.amazon.com/console',
      'https://news.ycombinator.com',
    ])
  })
})

describe('collectFolderIds', () => {
  it('lists every folder id', () => {
    expect(collectFolderIds(sampleTree())).toEqual(['bar', 'dev'])
  })
})

describe('searchTree', () => {
  it('keeps bookmarks matching title/url/domain and their ancestors', () => {
    const result = searchTree(sampleTree(), 'react')
    expect(countTree(result)).toEqual({ folders: 2, bookmarks: 1 })
  })

  it('keeps a whole folder when the folder title matches', () => {
    const result = searchTree(sampleTree(), 'dev')
    // "Dev" folder kept verbatim with both its bookmarks.
    expect(countTree(result)).toEqual({ folders: 2, bookmarks: 2 })
  })

  it('returns the original forest for an empty query', () => {
    expect(countTree(searchTree(sampleTree(), '   '))).toEqual({ folders: 2, bookmarks: 3 })
  })

  it('does not mutate the input tree', () => {
    const tree = sampleTree()
    searchTree(tree, 'react')
    expect(countTree(tree)).toEqual({ folders: 2, bookmarks: 3 })
  })
})

describe('filterByDomain', () => {
  it('keeps only bookmarks of the given domain', () => {
    const result = filterByDomain(sampleTree(), 'react.dev')
    expect(countTree(result)).toEqual({ folders: 2, bookmarks: 1 })
  })
})

describe('sortTree', () => {
  it('orders folders before bookmarks then by title', () => {
    const sorted = sortTree(sampleTree(), 'title')
    const bar = sorted[0] as FolderNode
    expect(bar.children.map((c) => c.title)).toEqual(['Dev', 'Hacker News'])
  })

  it('sorts bookmarks by domain within a folder', () => {
    const sorted = sortTree(sampleTree(), 'domain')
    const dev = (sorted[0] as FolderNode).children[0] as FolderNode
    expect(dev.children.map((c) => c.title)).toEqual(['AWS console', 'React docs'])
  })
})

describe('flattenVisible', () => {
  it('emits only top-level nodes when nothing is expanded', () => {
    const flat = flattenVisible(sampleTree(), new Set())
    expect(flat).toHaveLength(1)
    expect(flat[0]).toMatchObject({ depth: 0, hasChildren: true, isExpanded: false })
  })

  it('emits children with increasing depth when expanded', () => {
    const flat = flattenVisible(sampleTree(), new Set(['bar', 'dev']))
    expect(flat.map((f) => f.node.title)).toEqual([
      'Bookmarks Bar',
      'Dev',
      'React docs',
      'AWS console',
      'Hacker News',
    ])
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 2, 2, 1])
  })

  it('treats every folder as expanded with expandAll', () => {
    const flat = flattenVisible(sampleTree(), new Set(), { expandAll: true })
    expect(flat).toHaveLength(5)
  })
})

describe('collectOriginalPaths', () => {
  it('maps each bookmark to its ancestor folders below the root', () => {
    expect(collectOriginalPaths(sampleTree())).toEqual({
      'https://react.dev/learn': ['Dev'],
      'https://aws.amazon.com/console': ['Dev'],
      'https://news.ycombinator.com': [],
    })
  })
})

describe('topLevelFolderTitles', () => {
  it('returns the child folder titles of one root', () => {
    expect(topLevelFolderTitles(sampleTree()[0])).toEqual(['Dev'])
  })
  it('returns empty for undefined or a bookmark node', () => {
    expect(topLevelFolderTitles(undefined)).toEqual([])
  })
})

describe('collectRootTitleByUrl', () => {
  it('maps each bookmark to its top-level root title', () => {
    expect(collectRootTitleByUrl(sampleTree())).toEqual({
      'https://react.dev/learn': 'Bookmarks Bar',
      'https://aws.amazon.com/console': 'Bookmarks Bar',
      'https://news.ycombinator.com': 'Bookmarks Bar',
    })
  })
})
