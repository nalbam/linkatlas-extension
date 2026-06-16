import { useEffect, useMemo, useState } from 'react'
import { estimateRecategorize } from '@/analysis/estimate'
import { buildRecategorizeInputs } from '@/analysis/recategorize'
import { type StoredAnalysis } from '@/analysis/types'
import { type ProviderId } from '@/ai/types'
import { buildApplyPlan } from '@/apply/plan'
import {
  collectBookmarks,
  collectOriginalPaths,
  collectRootTitleByUrl,
  topLevelFolderTitles,
} from '@/bookmarks/tree'
import { isFolder, type TreeNode } from '@/bookmarks/types'
import { type BookmarkMetadata } from '@/metadata/types'
import { UNCATEGORIZED, buildRootTree, type Placement } from '@/organize/operations'
import { type Path, pathKey, rebasePrefix } from '@/organize/path'
import { type PathTreeNode, type RootTreeNode } from '@/organize/types'
import { useAnalysisStore } from '@/state/analysisStore'
import { useApplyStore } from '@/state/applyStore'
import { useOrganizeStore } from '@/state/organizeStore'
import { useSettingsStore } from '@/state/settingsStore'
import { Button } from '@/ui/components/Button'
import { Icon } from '@/ui/components/Icon'
import { ApplyDialog } from './ApplyDialog'
import { type MoveTarget } from './CategorySection'
import { RootSection } from './RootSection'

interface OrganizeViewProps {
  roots: TreeNode[]
  analysisByUrl: Record<string, StoredAnalysis>
  metadataByUrl: Record<string, BookmarkMetadata>
  onOpen: (url: string) => void
}

/** Host permission requested per provider before the recategorize call. */
const HOST_BY_PROVIDER: Record<ProviderId, string> = {
  openai: 'https://api.openai.com/*',
  gemini: 'https://generativelanguage.googleapis.com/*',
  claude: 'https://api.anthropic.com/*',
}

/** Every real (non-Uncategorized) path across all 大, as a move/merge target. */
function collectMoveTargets(forest: readonly RootTreeNode[]): MoveTarget[] {
  const out: MoveTarget[] = []
  for (const root of forest) {
    const walk = (nodes: readonly PathTreeNode[]) => {
      for (const node of nodes) {
        if (node.path[0] !== UNCATEGORIZED) {
          out.push({
            key: `${root.rootId}:${pathKey(node.path)}`,
            label: `${root.title} / ${node.path.join(' / ')}`,
            rootId: root.rootId,
            path: node.path,
          })
        }
        walk(node.children)
      }
    }
    walk(root.children)
  }
  return out
}

/** Placements for every bookmark under `node`, with each path mapped (rebased). */
function placementsUnder(node: PathTreeNode, mapPath: (path: Path) => Path): Placement[] {
  const out: Placement[] = []
  const walk = (current: PathTreeNode) => {
    for (const bookmark of current.bookmarks) out.push({ url: bookmark.url, path: mapPath(current.path) })
    current.children.forEach(walk)
  }
  walk(node)
  return out
}

/** Find a node by its 大 root id + path within the forest. */
function findNode(
  forest: readonly RootTreeNode[],
  rootId: string,
  path: Path,
): PathTreeNode | undefined {
  const root = forest.find((r) => r.rootId === rootId)
  if (!root) return undefined
  const targetKey = pathKey(path)
  const walk = (nodes: readonly PathTreeNode[]): PathTreeNode | undefined => {
    for (const node of nodes) {
      if (pathKey(node.path) === targetKey) return node
      const found = walk(node.children)
      if (found) return found
    }
    return undefined
  }
  return walk(root.children)
}

export function OrganizeView({ roots, analysisByUrl, metadataByUrl, onOpen }: OrganizeViewProps) {
  const organize = useOrganizeStore((s) => s.organize)
  const historyLength = useOrganizeStore((s) => s.history.length)
  const createPath = useOrganizeStore((s) => s.createPath)
  const moveBookmarksToRoot = useOrganizeStore((s) => s.moveBookmarksToRoot)
  const moveSubtreeToRoot = useOrganizeStore((s) => s.moveSubtreeToRoot)
  const renamePath = useOrganizeStore((s) => s.renamePath)
  const mergePaths = useOrganizeStore((s) => s.mergePaths)
  const deletePath = useOrganizeStore((s) => s.deletePath)
  const togglePurposeRoot = useOrganizeStore((s) => s.togglePurposeRoot)
  const seedPurposeRoots = useOrganizeStore((s) => s.seedPurposeRoots)
  const undo = useOrganizeStore((s) => s.undo)
  const reset = useOrganizeStore((s) => s.reset)

  const applyJob = useApplyStore((s) => s.job)
  const lastSummary = useApplyStore((s) => s.lastSummary)
  const hasSnapshot = useApplyStore((s) => s.hasSnapshot)
  const applyError = useApplyStore((s) => s.error)
  const startApply = useApplyStore((s) => s.startApply)
  const rollback = useApplyStore((s) => s.rollback)
  const refreshSnapshotFlag = useApplyStore((s) => s.refreshSnapshotFlag)

  const provider = useSettingsStore((s) => s.provider)
  const apiKey = useSettingsStore((s) => s.apiKeys[provider])
  const startRecategorize = useAnalysisStore((s) => s.startRecategorize)
  const clearAnalysis = useAnalysisStore((s) => s.clearAll)
  const analysisJob = useAnalysisStore((s) => s.job)
  const analysisError = useAnalysisStore((s) => s.error)

  const bookmarks = useMemo(() => collectBookmarks(roots), [roots])
  const originalPathByUrl = useMemo(() => collectOriginalPaths(roots), [roots])
  const originalRootByUrl = useMemo(() => collectRootTitleByUrl(roots), [roots])
  const rootsInfo = useMemo(
    () => roots.filter(isFolder).map((r) => ({ rootId: r.id, title: r.title || 'Bookmarks' })),
    [roots],
  )
  const tree = useMemo(
    () => buildRootTree(bookmarks, rootsInfo, originalPathByUrl, originalRootByUrl, analysisByUrl, organize),
    [bookmarks, rootsInfo, originalPathByUrl, originalRootByUrl, analysisByUrl, organize],
  )
  const moveTargets = useMemo(() => collectMoveTargets(tree), [tree])
  const plan = useMemo(() => buildApplyPlan(tree), [tree])
  // The bookmark bar (大 root id '1') is managed manually — never AI-recategorized.
  const effectiveRootByUrl = useMemo(
    () => ({ ...originalRootByUrl, ...organize.rootOverrides }),
    [originalRootByUrl, organize.rootOverrides],
  )
  const excludeRootTitles = useMemo(() => {
    const bar = roots.find((r) => r.id === '1')
    return bar ? [bar.title] : []
  }, [roots])
  const recat = useMemo(
    () =>
      buildRecategorizeInputs(
        bookmarks,
        originalPathByUrl,
        effectiveRootByUrl,
        organize.purposeRoots,
        excludeRootTitles,
        metadataByUrl,
      ),
    [bookmarks, originalPathByUrl, effectiveRootByUrl, organize.purposeRoots, excludeRootTitles, metadataByUrl],
  )
  const recatEstimate = useMemo(() => estimateRecategorize(recat.inputs), [recat])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [moveTargetKey, setMoveTargetKey] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [recatOpen, setRecatOpen] = useState(false)
  const [targetCount, setTargetCount] = useState(8)
  const [resetOpen, setResetOpen] = useState(false)

  // Auto-detect purpose groups from the bookmark bar's top-level folders (once).
  useEffect(() => {
    const bar = roots.find((r) => r.id === '1') ?? roots[0]
    seedPurposeRoots(topLevelFolderTitles(bar))
  }, [roots, seedPurposeRoots])

  // Detect whether a previous apply can still be rolled back.
  useEffect(() => {
    void refreshSnapshotFlag()
  }, [refreshSnapshotFlag])

  const titleOf = (rootId: string) => rootsInfo.find((r) => r.rootId === rootId)?.title ?? ''

  const toggleSelect = (url: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createPath([name])
    setNewName('')
  }

  const handleMoveSelected = () => {
    const target = moveTargets.find((t) => t.key === moveTargetKey)
    if (!target || selected.size === 0) return
    moveBookmarksToRoot([...selected], titleOf(target.rootId), target.path)
    setSelected(new Set())
    setMoveTargetKey('')
  }

  const handleMoveUrls = (urls: string[], toRootId: string, toPath: Path) =>
    moveBookmarksToRoot(urls, titleOf(toRootId), toPath)

  const handleMoveFolder = (fromRootId: string, fromPath: Path, toRootId: string, toPath: Path) => {
    const node = findNode(tree, fromRootId, fromPath)
    if (!node) return
    const toTitle = titleOf(toRootId)
    const affected = placementsUnder(node, (p) => rebasePrefix(p, fromPath, toPath)).map((pl) => ({
      ...pl,
      rootTitle: toTitle,
    }))
    moveSubtreeToRoot(fromPath, toTitle, toPath, affected)
  }

  const handleRename = (node: PathTreeNode, draft: string) => {
    const to = [...node.path.slice(0, -1), draft]
    renamePath(node.path, to, placementsUnder(node, (p) => rebasePrefix(p, node.path, to)))
  }

  const handleMerge = (node: PathTreeNode, into: Path) => {
    mergePaths([node.path], into, placementsUnder(node, (p) => rebasePrefix(p, node.path, into)))
  }

  const handleDelete = (node: PathTreeNode) => {
    deletePath(node.path, placementsUnder(node, () => [UNCATEGORIZED]))
  }

  const handleRecategorize = async () => {
    if (recat.inputs.length === 0 || !apiKey.trim() || analysisJob.running) return
    const granted = await chrome.permissions.request({ origins: [HOST_BY_PROVIDER[provider]] })
    if (!granted) return
    startRecategorize({
      provider,
      apiKey,
      inputs: recat.inputs,
      urlByIndex: recat.urlByIndex,
      targetCount,
    })
    setRecatOpen(false)
  }

  // Reset everything back to the current Chrome bookmarks: clear all manual
  // organize edits AND the AI classification cache.
  const handleReset = () => {
    reset()
    clearAnalysis()
    setSelected(new Set())
    setRecatOpen(false)
    setResetOpen(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/40 px-4 py-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
          placeholder="New folder"
          className="w-44 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <Button variant="default" onClick={handleCreate} disabled={!newName.trim()}>
          <Icon name="plus" size={16} />
          Add
        </Button>
        <Button variant="ghost" onClick={undo} disabled={historyLength === 0} title="Undo last change">
          <Icon name="undo" size={16} />
          Undo
        </Button>
        <Button
          variant="default"
          onClick={() => setRecatOpen((open) => !open)}
          disabled={recat.inputs.length === 0 || analysisJob.running}
          title="LLM으로 전체를 보고 비슷한 것끼리 재분류"
        >
          <Icon name="sparkle" size={16} />
          AI로 재정리
        </Button>
        {analysisError && !analysisJob.running && (
          <span className="max-w-[40%] truncate text-xs text-rose-300" title={analysisError}>
            재정리 실패: {analysisError}
          </span>
        )}
        <Button
          variant="ghost"
          onClick={() => setResetOpen((open) => !open)}
          title="모든 편집·AI 분류를 지우고 원본 폴더 구조로 되돌리기"
        >
          <Icon name="refresh" size={16} />
          리셋
        </Button>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted">{selected.size} selected</span>
            <select
              value={moveTargetKey}
              onChange={(event) => setMoveTargetKey(event.target.value)}
              className="max-w-[16rem] rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none"
            >
              <option value="">Move to…</option>
              {moveTargets.map((target) => (
                <option key={target.key} value={target.key}>
                  {target.label}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={handleMoveSelected} disabled={!moveTargetKey}>
              Move
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {(recatOpen || analysisJob.running) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/40 px-4 py-2 text-sm">
          {analysisJob.running ? (
            <span className="text-slate-200">
              AI로 재정리 중… {analysisJob.done}/{analysisJob.total}
            </span>
          ) : (
            <>
              <span className="text-slate-200">
                {recat.inputs.length}개 북마크를 비슷한 것끼리 재분류합니다 (목적 그룹 제외). 약 $
                {recatEstimate.approxUsd.toFixed(3)}.
              </span>
              <label className="flex items-center gap-1 text-muted">
                목표 카테고리 수
                <input
                  type="number"
                  min={2}
                  max={40}
                  value={targetCount}
                  onChange={(event) => setTargetCount(Math.max(2, Number(event.target.value) || 2))}
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-slate-100 focus:border-accent focus:outline-none"
                />
              </label>
              {!apiKey.trim() && (
                <span className="text-rose-300">설정에서 API 키를 입력하세요.</span>
              )}
              <Button variant="primary" onClick={handleRecategorize} disabled={!apiKey.trim()}>
                실행
              </Button>
              <Button variant="ghost" onClick={() => setRecatOpen(false)}>
                취소
              </Button>
            </>
          )}
        </div>
      )}

      {resetOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/40 px-4 py-2 text-sm">
          <span className="text-rose-300">
            모든 organize 편집과 AI 분류를 지우고 원본 Chrome 폴더 구조로 되돌립니다. 되돌릴 수 없습니다.
          </span>
          <Button variant="primary" onClick={handleReset}>
            초기화
          </Button>
          <Button variant="ghost" onClick={() => setResetOpen(false)}>
            취소
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/40 px-4 py-2">
        {applyJob.running ? (
          <div className="flex flex-1 items-center gap-3">
            <span className="shrink-0 text-sm text-slate-200">
              {applyJob.mode === 'rollback' ? 'Rolling back' : 'Applying'}… {applyJob.done}/
              {applyJob.total}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${applyJob.total ? Math.round((applyJob.done / applyJob.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={() => setApplyOpen(true)}
              disabled={plan.bookmarksToMove === 0}
              title="Create folders and move bookmarks in Chrome"
            >
              <Icon name="upload" size={16} />
              {plan.bookmarksToMove > 0 ? `Apply to Chrome · ${plan.bookmarksToMove}` : 'Nothing to apply'}
            </Button>
            {hasSnapshot && (
              <Button variant="default" onClick={rollback} title="Undo the last apply">
                <Icon name="undo" size={16} />
                Rollback
              </Button>
            )}
            {lastSummary && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <Icon name="check" size={14} />
                {lastSummary.created} folders · {lastSummary.moved} moved
              </span>
            )}
            {applyError && <span className="text-xs text-rose-300">{applyError}</span>}
          </>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {bookmarks.length === 0 ? (
          <p className="text-sm text-muted">No bookmarks to organize.</p>
        ) : (
          tree.map((root) => (
            <RootSection
              key={root.rootId}
              root={root}
              moveTargets={moveTargets}
              metadataByUrl={metadataByUrl}
              selectedUrls={selected}
              onToggleSelect={toggleSelect}
              onOpen={onOpen}
              onMoveUrls={handleMoveUrls}
              onMoveFolder={handleMoveFolder}
              onRename={handleRename}
              onMerge={handleMerge}
              onDelete={handleDelete}
              onTogglePurpose={togglePurposeRoot}
            />
          ))
        )}
      </div>

      <ApplyDialog
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        plan={plan}
        onConfirm={() => startApply({ assignments: plan.assignments })}
      />
    </div>
  )
}
