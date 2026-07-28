import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock3,
  CloudOff,
  Edit3,
  FolderPlus,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { CategoryEditorDialog } from '../components/CategoryEditorDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LinkCard } from '../components/LinkCard'
import { LinkEditorDialog, type LinkEditorSubmitValue } from '../components/LinkEditorDialog'
import { SyncStatus } from '../components/SyncStatus'
import { ToastViewport } from '../components/ToastViewport'
import {
  useWorkspaceActions,
  useWorkspaceState,
} from '../contexts/WorkspaceContext'
import { openExternalSite } from '../domain/command-execution'
import { isSafeNavigationUrl } from '../domain/nav-config'
import {
  addCategory,
  addSite,
  deleteCategory,
  deleteSite,
  moveSite,
  reorderCategories,
  reorderSites,
  restoreWorkspaceSnapshot,
  updateCategory,
  updateSite,
  type WorkspaceMutationResult,
} from '../domain/workspace-mutations'
import type {
  ISODateTime,
  NavCategoryV2,
  NavConfigV2,
  NavLinkV2,
  UUID,
} from '../types/workspace'
import '../App.css'

interface DragData {
  type: 'category' | 'category-drop' | 'site'
  categoryId: UUID
}

type LinkEditorState =
  | { mode: 'create'; categoryId: UUID | null }
  | { mode: 'edit'; categoryId: UUID; initialCategoryId: UUID; link: NavLinkV2 }

type CategoryEditorState =
  | { mode: 'create'; openSiteAfterSave: boolean }
  | { mode: 'edit'; category: NavCategoryV2 }

type DeleteRequest =
  | { kind: 'site'; category: NavCategoryV2; link: NavLinkV2 }
  | { kind: 'category'; category: NavCategoryV2 }

interface UndoRecord {
  snapshot: NavConfigV2
  expectedRevision: number
  message: string
}

interface MutationFeedback {
  undoMessage?: string
  successMessage?: string
}

function createUuid(): UUID {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('当前浏览器无法创建安全的资源 ID。')
  }
  return globalThis.crypto.randomUUID() as UUID
}

function dragData(value: unknown): DragData | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<DragData>
  if (
    (candidate.type === 'category' || candidate.type === 'category-drop' || candidate.type === 'site') &&
    typeof candidate.categoryId === 'string'
  ) {
    return candidate as DragData
  }
  return undefined
}

function findSite(document: NavConfigV2, siteId: UUID) {
  for (const category of document.categories) {
    const index = category.links.findIndex((link) => link.id === siteId)
    if (index >= 0) return { category, index, link: category.links[index] }
  }
  return undefined
}

interface SortableSiteProps {
  category: NavCategoryV2
  categories: readonly NavCategoryV2[]
  link: NavLinkV2
  index: number
  editing: boolean
  dragEnabled: boolean
  favorite: boolean
  onOpen: () => void
  onToggleFavorite: () => void
  onEdit: () => void
  onDelete: () => void
  onMoveBy: (offset: -1 | 1) => void
  onMoveCategory: (categoryId: UUID) => void
}

function SortableSite({
  category,
  categories,
  link,
  index,
  editing,
  dragEnabled,
  favorite,
  onOpen,
  onToggleFavorite,
  onEdit,
  onDelete,
  onMoveBy,
  onMoveCategory,
}: SortableSiteProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    data: { type: 'site', categoryId: category.id } satisfies DragData,
    disabled: !dragEnabled,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  }

  return (
    <div ref={setNodeRef} className={`navigation-site-sortable${editing ? ' editing' : ''}`} style={style}>
      {editing && (
        <button
          type="button"
          className="site-drag-handle"
          disabled={!dragEnabled}
          aria-label={`拖动 ${link.name} 调整位置`}
          title={dragEnabled ? '拖动或按空格后用方向键调整位置' : '清除筛选后可排序'}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={18} />
        </button>
      )}
      <LinkCard
        link={link}
        isEditing={editing}
        isFavorite={favorite}
        currentCategoryId={category.id}
        categoryOptions={categories}
        canMoveUp={index > 0}
        canMoveDown={index < category.links.length - 1}
        onOpen={onOpen}
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
        onDelete={onDelete}
        onMoveUp={() => onMoveBy(-1)}
        onMoveDown={() => onMoveBy(1)}
        onMoveCategory={onMoveCategory}
      />
    </div>
  )
}

interface SortableCategoryProps {
  category: NavCategoryV2
  sourceCategory: NavCategoryV2
  categories: readonly NavCategoryV2[]
  categoryIndex: number
  editing: boolean
  dragEnabled: boolean
  favoriteIds: ReadonlySet<UUID>
  childrenForEmpty?: ReactNode
  onAddSite: () => void
  onEditCategory: () => void
  onDeleteCategory: () => void
  onMoveCategoryBy: (offset: -1 | 1) => void
  onOpenSite: (link: NavLinkV2) => void
  onToggleFavorite: (link: NavLinkV2) => void
  onEditSite: (link: NavLinkV2) => void
  onDeleteSite: (link: NavLinkV2) => void
  onMoveSiteBy: (link: NavLinkV2, offset: -1 | 1) => void
  onMoveSiteCategory: (link: NavLinkV2, categoryId: UUID) => void
}

function SortableCategory({
  category,
  sourceCategory,
  categories,
  categoryIndex,
  editing,
  dragEnabled,
  favoriteIds,
  childrenForEmpty,
  onAddSite,
  onEditCategory,
  onDeleteCategory,
  onMoveCategoryBy,
  onOpenSite,
  onToggleFavorite,
  onEditSite,
  onDeleteSite,
  onMoveSiteBy,
  onMoveSiteCategory,
}: SortableCategoryProps) {
  const sortable = useSortable({
    id: category.id,
    data: { type: 'category', categoryId: category.id } satisfies DragData,
    disabled: !dragEnabled,
  })
  const droppable = useDroppable({
    id: `category-drop:${category.id}`,
    data: { type: 'category-drop', categoryId: category.id } satisfies DragData,
    disabled: !dragEnabled,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.3 : 1,
  }

  return (
    <section
      ref={sortable.setNodeRef}
      className={`navigation-category${droppable.isOver ? ' drop-target' : ''}`}
      style={style}
      aria-labelledby={`category-${category.id}`}
    >
      <header className="navigation-category-header">
        <div className="navigation-category-title">
          {editing && (
            <button
              type="button"
              className="category-drag-handle"
              disabled={!dragEnabled}
              aria-label={`拖动分类 ${category.name} 调整位置`}
              title={dragEnabled ? '拖动或按空格后用方向键调整位置' : '清除筛选后可排序'}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical aria-hidden="true" size={19} />
            </button>
          )}
          <div>
            <h2 id={`category-${category.id}`}>{category.name}</h2>
            <span>
              {category.links.length === sourceCategory.links.length
                ? `${sourceCategory.links.length} 个网站`
                : `显示 ${category.links.length}/${sourceCategory.links.length} 个网站`}
            </span>
          </div>
        </div>
        {editing && (
          <div className="navigation-category-actions">
            <button
              type="button"
              disabled={categoryIndex === 0}
              aria-label={`上移分类 ${category.name}`}
              title="上移分类"
              onClick={() => onMoveCategoryBy(-1)}
            ><ArrowUp aria-hidden="true" size={17} /></button>
            <button
              type="button"
              disabled={categoryIndex === categories.length - 1}
              aria-label={`下移分类 ${category.name}`}
              title="下移分类"
              onClick={() => onMoveCategoryBy(1)}
            ><ArrowDown aria-hidden="true" size={17} /></button>
            <button type="button" aria-label={`编辑分类 ${category.name}`} title="编辑分类" onClick={onEditCategory}>
              <Edit3 aria-hidden="true" size={17} />
            </button>
            <button className="danger" type="button" aria-label={`删除分类 ${category.name}`} title="删除分类" onClick={onDeleteCategory}>
              <Trash2 aria-hidden="true" size={17} />
            </button>
          </div>
        )}
      </header>

      <SortableContext items={category.links.map((link) => link.id)} strategy={rectSortingStrategy}>
        <div ref={droppable.setNodeRef} className="navigation-site-grid">
          {category.links.map((link) => (
            <SortableSite
              key={link.id}
              category={sourceCategory}
              categories={categories}
              link={link}
              index={sourceCategory.links.findIndex((candidate) => candidate.id === link.id)}
              editing={editing}
              dragEnabled={dragEnabled}
              favorite={favoriteIds.has(link.id)}
              onOpen={() => onOpenSite(link)}
              onToggleFavorite={() => onToggleFavorite(link)}
              onEdit={() => onEditSite(link)}
              onDelete={() => onDeleteSite(link)}
              onMoveBy={(offset) => onMoveSiteBy(link, offset)}
              onMoveCategory={(categoryId) => onMoveSiteCategory(link, categoryId)}
            />
          ))}
          {childrenForEmpty}
          {editing && (
            <button type="button" className="navigation-add-site" onClick={onAddSite}>
              <Plus aria-hidden="true" size={20} />
              <span>添加网站</span>
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

export default function Navigation() {
  const [searchParams] = useSearchParams()
  const state = useWorkspaceState()
  const actions = useWorkspaceActions()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [linkEditor, setLinkEditor] = useState<LinkEditorState | null>(() =>
    searchParams.get('add') === 'site' ? { mode: 'create', categoryId: null } : null,
  )
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditorState | null>(null)
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
  const [undo, setUndo] = useState<UndoRecord | null>(null)
  const [notice, setNotice] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [activeDrag, setActiveDrag] = useState<{ type: DragData['type']; id: UUID } | null>(null)
  const undoTimerRef = useRef<number | null>(null)
  const undoDeadlineRef = useRef(0)
  const undoRemainingRef = useRef(7000)

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current)
  }, [])

  const document = state.document
  const categories = useMemo(
    () => [...(document?.categories ?? [])].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
    [document?.categories],
  )
  const favoriteIds = useMemo(
    () => new Set(
      document?.favorites
        .filter((favorite) => favorite.ref.kind === 'site')
        .map((favorite) => favorite.ref.id as UUID) ?? [],
    ),
    [document?.favorites],
  )
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return categories
    return categories.flatMap((category) => {
      if (category.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery)) return [category]
      const links = category.links.filter((link) =>
        [link.name, link.description, link.url].some((value) =>
          value.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
        ),
      )
      return links.length > 0 ? [{ ...category, links }] : []
    })
  }, [categories, normalizedQuery])
  const dragEnabled = editing && normalizedQuery.length === 0 && !state.readOnly

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const clearUndoTimer = () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current)
    undoTimerRef.current = null
  }

  const dismissUndo = () => {
    clearUndoTimer()
    setUndo(null)
  }

  const armUndoTimer = (delay: number) => {
    clearUndoTimer()
    undoRemainingRef.current = delay
    undoDeadlineRef.current = Date.now() + delay
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null
      setUndo(null)
    }, delay)
  }

  const showUndo = (snapshot: NavConfigV2, message: string) => {
    setUndo({ snapshot, expectedRevision: snapshot.revision + 1, message })
    armUndoTimer(7000)
  }

  const pauseUndo = () => {
    if (!undo || undoTimerRef.current === null) return
    undoRemainingRef.current = Math.max(0, undoDeadlineRef.current - Date.now())
    clearUndoTimer()
  }

  const resumeUndo = () => {
    if (!undo || undoTimerRef.current !== null) return
    if (undoRemainingRef.current <= 0) dismissUndo()
    else armUndoTimer(undoRemainingRef.current)
  }

  const runMutation = (
    mutate: (current: NavConfigV2, now: ISODateTime) => WorkspaceMutationResult,
    feedback: MutationFeedback = {},
  ): boolean => {
    let outcome: WorkspaceMutationResult | undefined
    const committed = actions.commit((current, metadata) => {
      outcome = mutate(current, metadata.now)
      if (!outcome.ok) throw new Error(outcome.error.code)
      return outcome.document
    })

    if (!committed || !outcome || !outcome.ok) {
      setNotice(outcome && !outcome.ok ? outcome.error.message : '这次修改未能安全保存，请重试。')
      return false
    }
    setNotice(feedback.successMessage ?? '')
    if (feedback.undoMessage) showUndo(outcome.before, feedback.undoMessage)
    else dismissUndo()
    return true
  }

  const openSite = (link: NavLinkV2) => {
    if (!isSafeNavigationUrl(link.url)) {
      setNotice(`“${link.name}”的网址不安全，已阻止打开。`)
      return
    }
    if (!openExternalSite(link.url)) {
      setNotice('浏览器阻止了新窗口，请允许弹出窗口后重试。')
      return
    }
    dismissUndo()
    actions.recordRecent({ kind: 'site', id: link.id })
  }

  const toggleFavorite = (link: NavLinkV2) => {
    dismissUndo()
    if (!actions.toggleFavorite({ kind: 'site', id: link.id })) {
      setNotice('收藏修改未能保存，请重试。')
    }
  }

  const startAddSite = (categoryId?: UUID) => {
    if (state.readOnly) return
    const target = categoryId ?? categories[0]?.id ?? null
    if (!target) {
      setCategoryEditor({ mode: 'create', openSiteAfterSave: true })
      return
    }
    setLinkEditor({ mode: 'create', categoryId: target })
  }

  const moveCategoryBy = (category: NavCategoryV2, offset: -1 | 1) => {
    const fromIndex = categories.findIndex((candidate) => candidate.id === category.id)
    const toIndex = fromIndex + offset
    if (fromIndex < 0 || toIndex < 0 || toIndex >= categories.length) return
    runMutation(
      (current, now) => reorderCategories(current, { categoryId: category.id, toIndex, now }),
      { undoMessage: `已移动分类“${category.name}”` },
    )
  }

  const moveSiteBy = (category: NavCategoryV2, link: NavLinkV2, offset: -1 | 1) => {
    const fromIndex = category.links.findIndex((candidate) => candidate.id === link.id)
    const toIndex = fromIndex + offset
    if (fromIndex < 0 || toIndex < 0 || toIndex >= category.links.length) return
    runMutation(
      (current, now) => reorderSites(current, { categoryId: category.id, siteId: link.id, toIndex, now }),
      { undoMessage: `已移动“${link.name}”` },
    )
  }

  const moveSiteToCategory = (link: NavLinkV2, categoryId: UUID) => {
    if (!document) return
    const source = findSite(document, link.id)
    const target = categories.find((category) => category.id === categoryId)
    if (!source || !target || source.category.id === target.id) return
    runMutation(
      (current, now) => moveSite(current, {
        siteId: link.id,
        toCategoryId: target.id,
        toIndex: target.links.length,
        now,
      }),
      { undoMessage: `已将“${link.name}”移至“${target.name}”` },
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = dragData(event.active.data.current)
    if (!data || !dragEnabled) return
    const id = String(event.active.id) as UUID
    setActiveDrag({ type: data.type, id })
    const label = data.type === 'site'
      ? findSite(document as NavConfigV2, id)?.link.name
      : categories.find((category) => category.id === id)?.name
    setAnnouncement(`已抓取${data.type === 'site' ? '网站' : '分类'}${label ? `“${label}”` : ''}，使用方向键移动，空格放下，Esc 取消。`)
  }

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveDrag(null)
    setAnnouncement('已取消排序，位置未改变。')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    if (!document || !event.over || !dragEnabled) return
    const activeData = dragData(event.active.data.current)
    const overData = dragData(event.over.data.current)
    if (!activeData || !overData) return
    const activeId = String(event.active.id) as UUID

    if (activeData.type === 'category') {
      const toIndex = categories.findIndex((category) => category.id === overData.categoryId)
      const category = categories.find((candidate) => candidate.id === activeId)
      const fromIndex = categories.findIndex((candidate) => candidate.id === activeId)
      if (!category || toIndex < 0 || fromIndex === toIndex) return
      if (runMutation(
        (current, now) => reorderCategories(current, { categoryId: activeId, toIndex, now }),
        { undoMessage: `已移动分类“${category.name}”` },
      )) setAnnouncement(`分类“${category.name}”已移至第 ${toIndex + 1} 位。`)
      return
    }

    if (activeData.type !== 'site') return
    const source = findSite(document, activeId)
    const targetCategory = categories.find((category) => category.id === overData.categoryId)
    if (!source || !targetCategory) return
    const overId = String(event.over.id)
    const overIndex = overData.type === 'site'
      ? targetCategory.links.findIndex((link) => link.id === overId)
      : targetCategory.links.length
    const toIndex = Math.max(0, overIndex)
    const sameCategory = source.category.id === targetCategory.id
    if (sameCategory && source.index === toIndex) return

    const succeeded = sameCategory
      ? runMutation(
          (current, now) => reorderSites(current, {
            categoryId: source.category.id,
            siteId: activeId,
            toIndex: Math.min(toIndex, source.category.links.length - 1),
            now,
          }),
          { undoMessage: `已移动“${source.link.name}”` },
        )
      : runMutation(
          (current, now) => moveSite(current, {
            siteId: activeId,
            toCategoryId: targetCategory.id,
            toIndex: Math.min(toIndex, targetCategory.links.length),
            now,
          }),
          { undoMessage: `已将“${source.link.name}”移至“${targetCategory.name}”` },
        )
    if (succeeded) {
      setAnnouncement(`网站“${source.link.name}”已移至“${targetCategory.name}”第 ${toIndex + 1} 位。`)
    }
  }

  const submitLink = (value: LinkEditorSubmitValue) => {
    if (!linkEditor || !document) return
    const { categoryId: submittedCategoryId, ...linkValue } = value
    const targetCategoryId = submittedCategoryId ?? linkEditor.categoryId ?? categories[0]?.id
    if (!targetCategoryId) {
      setNotice('请先创建一个分类。')
      return
    }

    if (linkEditor.mode === 'create') {
      const id = createUuid()
      if (runMutation(
        (current, now) => addSite(current, { categoryId: targetCategoryId, id, ...linkValue, now }),
        { successMessage: `已添加“${linkValue.name}”` },
      )) setLinkEditor(null)
      return
    }

    const editor = linkEditor
    const unchanged =
      editor.initialCategoryId === targetCategoryId &&
      editor.link.name === linkValue.name &&
      editor.link.url === linkValue.url &&
      editor.link.description === linkValue.description &&
      (editor.link.icon ?? '') === (linkValue.icon ?? '')
    if (unchanged) {
      setLinkEditor(null)
      return
    }

    const moved = editor.initialCategoryId !== targetCategoryId
    const succeeded = runMutation(
      (current, now) => {
        const updated = updateSite(current, {
          siteId: editor.link.id,
          name: linkValue.name,
          url: linkValue.url,
          description: linkValue.description,
          icon: linkValue.icon ?? null,
          now,
        })
        const base = updated.ok ? updated.document : current
        if (!updated.ok && updated.error.code !== 'NO_CHANGE') return updated
        if (!moved) return updated
        const target = base.categories.find((category) => category.id === targetCategoryId)
        if (!target) return moveSite(base, { siteId: editor.link.id, toCategoryId: targetCategoryId, toIndex: 0, now })
        const movedResult = moveSite(base, {
          siteId: editor.link.id,
          toCategoryId: targetCategoryId,
          toIndex: target.links.length,
          now,
        })
        return movedResult.ok && updated.ok ? { ...movedResult, before: updated.before } : movedResult
      },
      moved
        ? { undoMessage: `已将“${linkValue.name}”移至其他分类` }
        : { successMessage: `已更新“${linkValue.name}”` },
    )
    if (succeeded) setLinkEditor(null)
  }

  const submitCategory = (name: string): boolean => {
    if (!categoryEditor) return false
    if (categoryEditor.mode === 'edit') {
      if (categoryEditor.category.name === name) {
        setCategoryEditor(null)
        return true
      }
      const succeeded = runMutation(
        (current, now) => updateCategory(current, { categoryId: categoryEditor.category.id, name, now }),
        { successMessage: `已更新分类“${name}”` },
      )
      if (succeeded) setCategoryEditor(null)
      return succeeded
    }

    const id = createUuid()
    const openSiteAfterSave = categoryEditor.openSiteAfterSave
    const succeeded = runMutation(
      (current, now) => addCategory(current, { id, name, now }),
      { successMessage: `已创建分类“${name}”` },
    )
    if (succeeded) {
      setCategoryEditor(null)
      if (openSiteAfterSave) setLinkEditor({ mode: 'create', categoryId: id })
    }
    return succeeded
  }

  const confirmDelete = () => {
    if (!deleteRequest) return
    if (deleteRequest.kind === 'site') {
      const { link } = deleteRequest
      if (runMutation(
        (current, now) => deleteSite(current, { siteId: link.id, now }),
        { undoMessage: `已删除网站“${link.name}”` },
      )) setDeleteRequest(null)
      return
    }
    const { category } = deleteRequest
    if (runMutation(
      (current, now) => deleteCategory(current, { categoryId: category.id, now }),
      { undoMessage: `已删除分类“${category.name}”及其中 ${category.links.length} 个网站` },
    )) setDeleteRequest(null)
  }

  const restoreUndo = () => {
    if (!undo || !document) return
    if (document.revision !== undo.expectedRevision) {
      dismissUndo()
      setNotice('撤销前工作区已有其他修改，为避免覆盖新内容，本次撤销已取消。')
      return
    }
    const snapshot = undo.snapshot
    dismissUndo()
    if (actions.commit(() => restoreWorkspaceSnapshot(snapshot))) {
      setNotice('已撤销上一步操作。')
    } else {
      setNotice('撤销失败，当前内容保持不变。')
    }
  }

  if (state.status.tag === 'fatal' && !document) {
    return (
      <section className="workspace-unavailable" role="alert">
        <CloudOff aria-hidden="true" size={28} />
        <h1>无法载入个人导航</h1>
        <p>{state.status.error.message}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>重新载入</button>
      </section>
    )
  }

  if (!state.ready || !document) {
    return (
      <div className="navigation-page navigation-loading" aria-busy="true" aria-label="正在载入我的导航">
        <div className="navigation-skeleton navigation-skeleton-header" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="navigation-skeleton navigation-skeleton-category" />
        ))}
      </div>
    )
  }

  const activeLink = activeDrag?.type === 'site' ? findSite(document, activeDrag.id)?.link : undefined
  const activeCategory = activeDrag?.type === 'category'
    ? categories.find((category) => category.id === activeDrag.id)
    : undefined
  const selectedCategoryId = linkEditor?.categoryId ?? categories[0]?.id ?? null

  return (
    <div className="navigation-page page-container">
      <header className="navigation-page-header">
        <div className="navigation-heading">
          <div>
            <p className="navigation-eyebrow">个人工作区</p>
            <h1>我的导航</h1>
          </div>
          <SyncStatus compact />
        </div>

        <div className="navigation-toolbar">
          <label className="navigation-search">
            <Search aria-hidden="true" size={19} />
            <span className="sr-only">筛选网站</span>
            <input
              type="search"
              value={query}
              placeholder="筛选名称、描述或网址…"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" aria-label="清除筛选" onClick={() => setQuery('')}>
                <X aria-hidden="true" size={17} />
              </button>
            )}
          </label>
          <div className="navigation-primary-actions">
            {editing && (
              <button type="button" className="btn btn-secondary" onClick={() => setCategoryEditor({ mode: 'create', openSiteAfterSave: false })}>
                <FolderPlus aria-hidden="true" size={18} />新增分类
              </button>
            )}
            <button type="button" className="btn btn-secondary" aria-pressed={editing} onClick={() => setEditing((current) => !current)}>
              {editing ? <Check aria-hidden="true" size={18} /> : <Edit3 aria-hidden="true" size={18} />}
              {editing ? '完成编辑' : '编辑布局'}
            </button>
            <button type="button" className="btn" onClick={() => startAddSite()}>
              <Plus aria-hidden="true" size={18} />新增网站
            </button>
          </div>
        </div>
      </header>

      {normalizedQuery && editing && (
        <div className="navigation-filter-note" role="status">
          <Clock3 aria-hidden="true" size={17} />正在筛选内容；清除筛选后可拖拽排序。编辑、移动和删除仍按稳定 ID 执行。
        </div>
      )}
      {notice && (
        <div className="navigation-notice" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice('')}><X aria-hidden="true" size={17} /></button>
        </div>
      )}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{announcement}</div>

      {categories.length === 0 ? (
        <section className="navigation-empty">
          <FolderPlus aria-hidden="true" size={28} />
          <div><h2>建立第一个分类</h2><p>先创建分类，再把日常会打开的网站整理进来。</p></div>
          <button type="button" className="btn" onClick={() => setCategoryEditor({ mode: 'create', openSiteAfterSave: true })}>创建分类</button>
        </section>
      ) : filteredCategories.length === 0 ? (
        <section className="navigation-empty navigation-no-results">
          <Search aria-hidden="true" size={28} />
          <div><h2>没有匹配的网站</h2><p>换一个关键词，或直接新增网站。</p></div>
          <div className="navigation-empty-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>清除筛选</button>
            <button type="button" className="btn" onClick={() => startAddSite()}>新增网站</button>
          </div>
        </section>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filteredCategories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
            <div className="navigation-categories">
              {filteredCategories.map((category) => {
                const categoryIndex = categories.findIndex((candidate) => candidate.id === category.id)
                const sourceCategory = categories[categoryIndex]
                return (
                  <SortableCategory
                    key={category.id}
                    category={category}
                    sourceCategory={sourceCategory}
                    categories={categories}
                    categoryIndex={categoryIndex}
                    editing={editing}
                    dragEnabled={dragEnabled}
                    favoriteIds={favoriteIds}
                    onAddSite={() => startAddSite(category.id)}
                    onEditCategory={() => setCategoryEditor({ mode: 'edit', category: sourceCategory })}
                    onDeleteCategory={() => setDeleteRequest({ kind: 'category', category: sourceCategory })}
                    onMoveCategoryBy={(offset) => moveCategoryBy(sourceCategory, offset)}
                    onOpenSite={openSite}
                    onToggleFavorite={toggleFavorite}
                    onEditSite={(link) => setLinkEditor({
                      mode: 'edit',
                      categoryId: category.id,
                      initialCategoryId: category.id,
                      link,
                    })}
                    onDeleteSite={(link) => setDeleteRequest({ kind: 'site', category: sourceCategory, link })}
                    onMoveSiteBy={(link, offset) => moveSiteBy(sourceCategory, link, offset)}
                    onMoveSiteCategory={moveSiteToCategory}
                  />
                )
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeLink ? <div className="navigation-drag-overlay"><LinkCard link={activeLink} isDragOverlay /></div> : null}
            {activeCategory ? (
              <div className="navigation-category-overlay">
                <GripVertical aria-hidden="true" size={18} /><strong>{activeCategory.name}</strong><span>{activeCategory.links.length} 个网站</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <LinkEditorDialog
        open={Boolean(linkEditor && categories.length > 0)}
        mode={linkEditor?.mode ?? 'create'}
        initialValue={linkEditor?.mode === 'edit' ? linkEditor.link : undefined}
        categories={categories}
        selectedCategoryId={selectedCategoryId ?? ''}
        onSelectedCategoryIdChange={(categoryId) => setLinkEditor((current) => {
          if (!current) return current
          if (current.mode === 'edit') return categoryId ? { ...current, categoryId } : current
          return { ...current, categoryId: categoryId || null }
        })}
        onCancel={() => setLinkEditor(null)}
        onSubmit={submitLink}
      />

      {categoryEditor && (
        <CategoryEditorDialog
          key={categoryEditor.mode === 'edit' ? categoryEditor.category.id : 'create-category'}
          mode={categoryEditor.mode}
          initialName={categoryEditor.mode === 'edit' ? categoryEditor.category.name : ''}
          onCancel={() => setCategoryEditor(null)}
          onSave={submitCategory}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteRequest)}
        title={deleteRequest?.kind === 'category' ? `删除分类“${deleteRequest.category.name}”？` : `删除网站“${deleteRequest?.link.name}”？`}
        description={deleteRequest?.kind === 'category'
          ? <>这个分类包含 <strong>{deleteRequest.category.links.length}</strong> 个网站；相关收藏与最近记录也会清理。你可在 7 秒内撤销。</>
          : <>网站会从当前分类移除，相关收藏与最近记录也会清理。你可在 7 秒内撤销。</>}
        confirmLabel={deleteRequest?.kind === 'category' ? '删除分类' : '删除网站'}
        onCancel={() => setDeleteRequest(null)}
        onConfirm={confirmDelete}
      />

      <ToastViewport items={undo ? [{
        id: 'navigation-undo',
        message: undo.message,
        tone: 'warning',
        icon: <Clock3 aria-hidden="true" size={19} />,
        actionLabel: '撤销',
        onAction: restoreUndo,
        onDismiss: dismissUndo,
        onPause: pauseUndo,
        onResume: resumeUndo,
      }] : []} />
    </div>
  )
}
