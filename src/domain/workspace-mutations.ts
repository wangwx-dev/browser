import type {
  ISODateTime,
  NavConfigV2,
  NavLinkV2,
  ResourceRefV2,
  SafeHttpUrl,
  UUID,
} from '../types/workspace'
import { isSafeNavigationUrl, serializeNavConfigV2 } from './nav-config'

export type WorkspaceMutationKind =
  | 'category-added'
  | 'category-updated'
  | 'category-deleted'
  | 'categories-reordered'
  | 'site-added'
  | 'site-updated'
  | 'site-deleted'
  | 'sites-reordered'
  | 'site-moved'

export type WorkspaceMutationErrorCode =
  | 'CATEGORY_NOT_FOUND'
  | 'DUPLICATE_ID'
  | 'INVALID_DESCRIPTION'
  | 'INVALID_ID'
  | 'INVALID_INDEX'
  | 'INVALID_NAME'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_URL'
  | 'NO_CHANGE'
  | 'SITE_NOT_FOUND'

export interface WorkspaceMutationError {
  code: WorkspaceMutationErrorCode
  message: string
  field?: 'categoryId' | 'description' | 'id' | 'index' | 'name' | 'siteId' | 'timestamp' | 'url'
}

export interface WorkspaceMutationSuccess {
  ok: true
  kind: WorkspaceMutationKind
  document: NavConfigV2
  before: NavConfigV2
}

export interface WorkspaceMutationFailure {
  ok: false
  document: NavConfigV2
  error: WorkspaceMutationError
}

export type WorkspaceMutationResult = WorkspaceMutationSuccess | WorkspaceMutationFailure

interface TimestampedInput {
  now: ISODateTime
}

export interface AddCategoryInput extends TimestampedInput {
  id: UUID
  name: string
  index?: number
}

export interface UpdateCategoryInput extends TimestampedInput {
  categoryId: UUID
  name: string
}

export interface DeleteCategoryInput extends TimestampedInput {
  categoryId: UUID
}

export interface ReorderCategoriesInput extends TimestampedInput {
  categoryId: UUID
  toIndex: number
}

export interface AddSiteInput extends TimestampedInput {
  categoryId: UUID
  id: UUID
  name: string
  url: string
  description?: string
  icon?: string
  index?: number
}

export interface UpdateSiteInput extends TimestampedInput {
  siteId: UUID
  name?: string
  url?: string
  description?: string
  icon?: string | null
}

export interface DeleteSiteInput extends TimestampedInput {
  siteId: UUID
}

export interface ReorderSitesInput extends TimestampedInput {
  categoryId: UUID
  siteId: UUID
  toIndex: number
}

export interface MoveSiteInput extends TimestampedInput {
  siteId: UUID
  toCategoryId: UUID
  toIndex: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NAME_MAX_LENGTH = 80
const DESCRIPTION_MAX_LENGTH = 240
const URL_MAX_LENGTH = 2048

interface SiteLocation {
  categoryIndex: number
  siteIndex: number
}

function failure(
  document: NavConfigV2,
  code: WorkspaceMutationErrorCode,
  message: string,
  field?: WorkspaceMutationError['field'],
): WorkspaceMutationFailure {
  return { ok: false, document, error: { code, message, ...(field ? { field } : {}) } }
}

function isCanonicalTimestamp(value: string): boolean {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
}

function timestampFailure(
  document: NavConfigV2,
  now: ISODateTime,
): WorkspaceMutationFailure | undefined {
  if (isCanonicalTimestamp(now)) return undefined
  return failure(document, 'INVALID_TIMESTAMP', '变更时间必须是规范的 UTC ISO 时间。', 'timestamp')
}

function normalizeName(value: string): string | undefined {
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= NAME_MAX_LENGTH ? normalized : undefined
}

function normalizeDescription(value: string): string | undefined {
  const normalized = value.trim()
  return normalized.length <= DESCRIPTION_MAX_LENGTH ? normalized : undefined
}

function normalizeUrl(value: string): SafeHttpUrl | undefined {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > URL_MAX_LENGTH) return undefined
  return isSafeNavigationUrl(normalized) ? normalized : undefined
}

function normalizeIcon(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function entityIdExists(document: NavConfigV2, id: UUID): boolean {
  if (document.configId === id) return true
  return document.categories.some(
    (category) => category.id === id || category.links.some((link) => link.id === id),
  )
}

function validEntityId(id: UUID): boolean {
  return UUID_PATTERN.test(id)
}

function validIndex(index: number, maximum: number): boolean {
  return Number.isInteger(index) && index >= 0 && index <= maximum
}

function findSite(document: NavConfigV2, siteId: UUID): SiteLocation | undefined {
  for (let categoryIndex = 0; categoryIndex < document.categories.length; categoryIndex += 1) {
    const siteIndex = document.categories[categoryIndex].links.findIndex((link) => link.id === siteId)
    if (siteIndex >= 0) return { categoryIndex, siteIndex }
  }
  return undefined
}

function withoutSiteReferences(document: NavConfigV2, siteIds: ReadonlySet<UUID>): NavConfigV2 {
  const shouldRemove = (ref: ResourceRefV2) => ref.kind === 'site' && siteIds.has(ref.id)
  return {
    ...document,
    favorites: document.favorites.filter((favorite) => !shouldRemove(favorite.ref)),
    recents: document.recents.filter((recent) => !shouldRemove(recent.ref)),
  }
}

function withContinuousOrders(document: NavConfigV2, now: ISODateTime): NavConfigV2 {
  return {
    ...document,
    categories: document.categories.map((category, categoryIndex) => {
      let categoryChanged = category.order !== categoryIndex
      const links = category.links.map((link, linkIndex) => {
        if (link.order === linkIndex) return link
        categoryChanged = true
        return { ...link, order: linkIndex, updatedAt: now }
      })
      return categoryChanged
        ? { ...category, order: categoryIndex, links, updatedAt: now }
        : { ...category, links }
    }),
  }
}

function success(
  before: NavConfigV2,
  candidate: NavConfigV2,
  kind: WorkspaceMutationKind,
  now: ISODateTime,
): WorkspaceMutationSuccess {
  return {
    ok: true,
    kind,
    before,
    document: serializeNavConfigV2(withContinuousOrders(candidate, now)),
  }
}

function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const moved = [...items]
  const [item] = moved.splice(fromIndex, 1)
  moved.splice(toIndex, 0, item)
  return moved
}

export function addCategory(
  document: NavConfigV2,
  input: AddCategoryInput,
): WorkspaceMutationResult {
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp
  if (!validEntityId(input.id)) {
    return failure(document, 'INVALID_ID', '分类 ID 必须是有效 UUID。', 'id')
  }
  if (entityIdExists(document, input.id)) {
    return failure(document, 'DUPLICATE_ID', '分类 ID 已被现有实体使用。', 'id')
  }
  const name = normalizeName(input.name)
  if (!name) return failure(document, 'INVALID_NAME', '分类名称长度必须为 1–80 个字符。', 'name')
  const index = input.index ?? document.categories.length
  if (!validIndex(index, document.categories.length)) {
    return failure(document, 'INVALID_INDEX', '分类位置超出有效范围。', 'index')
  }

  const before = serializeNavConfigV2(document)
  const categories = [...before.categories]
  categories.splice(index, 0, {
    id: input.id,
    name,
    order: index,
    links: [],
    createdAt: input.now,
    updatedAt: input.now,
  })
  return success(before, { ...before, categories }, 'category-added', input.now)
}

export function updateCategory(
  document: NavConfigV2,
  input: UpdateCategoryInput,
): WorkspaceMutationResult {
  const categoryIndex = document.categories.findIndex((category) => category.id === input.categoryId)
  if (categoryIndex < 0) {
    return failure(document, 'CATEGORY_NOT_FOUND', '未找到要编辑的分类。', 'categoryId')
  }
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp
  const name = normalizeName(input.name)
  if (!name) return failure(document, 'INVALID_NAME', '分类名称长度必须为 1–80 个字符。', 'name')
  if (name === document.categories[categoryIndex].name) {
    return failure(document, 'NO_CHANGE', '分类内容没有变化。')
  }

  const before = serializeNavConfigV2(document)
  const categories = before.categories.map((category, index) =>
    index === categoryIndex ? { ...category, name, updatedAt: input.now } : category,
  )
  return success(before, { ...before, categories }, 'category-updated', input.now)
}

export function deleteCategory(
  document: NavConfigV2,
  input: DeleteCategoryInput,
): WorkspaceMutationResult {
  const categoryIndex = document.categories.findIndex((category) => category.id === input.categoryId)
  if (categoryIndex < 0) {
    return failure(document, 'CATEGORY_NOT_FOUND', '未找到要删除的分类。', 'categoryId')
  }
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp

  const before = serializeNavConfigV2(document)
  const siteIds = new Set(before.categories[categoryIndex].links.map((link) => link.id))
  const candidate = withoutSiteReferences(
    { ...before, categories: before.categories.filter((_, index) => index !== categoryIndex) },
    siteIds,
  )
  return success(before, candidate, 'category-deleted', input.now)
}

export function reorderCategories(
  document: NavConfigV2,
  input: ReorderCategoriesInput,
): WorkspaceMutationResult {
  const fromIndex = document.categories.findIndex((category) => category.id === input.categoryId)
  if (fromIndex < 0) {
    return failure(document, 'CATEGORY_NOT_FOUND', '未找到要排序的分类。', 'categoryId')
  }
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp
  if (!validIndex(input.toIndex, document.categories.length - 1)) {
    return failure(document, 'INVALID_INDEX', '分类目标位置超出有效范围。', 'index')
  }
  if (fromIndex === input.toIndex) return failure(document, 'NO_CHANGE', '分类位置没有变化。')

  const before = serializeNavConfigV2(document)
  const categories = moveItem(before.categories, fromIndex, input.toIndex).map((category) =>
    category.id === input.categoryId ? { ...category, updatedAt: input.now } : category,
  )
  return success(before, { ...before, categories }, 'categories-reordered', input.now)
}

export function addSite(document: NavConfigV2, input: AddSiteInput): WorkspaceMutationResult {
  const categoryIndex = document.categories.findIndex((category) => category.id === input.categoryId)
  if (categoryIndex < 0) {
    return failure(document, 'CATEGORY_NOT_FOUND', '未找到网站所属分类。', 'categoryId')
  }
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp
  if (!validEntityId(input.id)) return failure(document, 'INVALID_ID', '网站 ID 必须是有效 UUID。', 'id')
  if (entityIdExists(document, input.id)) {
    return failure(document, 'DUPLICATE_ID', '网站 ID 已被现有实体使用。', 'id')
  }
  const name = normalizeName(input.name)
  if (!name) return failure(document, 'INVALID_NAME', '网站名称长度必须为 1–80 个字符。', 'name')
  const url = normalizeUrl(input.url)
  if (!url) return failure(document, 'INVALID_URL', '网站 URL 必须是有效的 HTTP 或 HTTPS 地址。', 'url')
  const description = normalizeDescription(input.description ?? '')
  if (description === undefined) {
    return failure(document, 'INVALID_DESCRIPTION', '网站描述不能超过 240 个字符。', 'description')
  }
  const index = input.index ?? document.categories[categoryIndex].links.length
  if (!validIndex(index, document.categories[categoryIndex].links.length)) {
    return failure(document, 'INVALID_INDEX', '网站位置超出有效范围。', 'index')
  }

  const before = serializeNavConfigV2(document)
  const links = [...before.categories[categoryIndex].links]
  const icon = normalizeIcon(input.icon)
  const site: NavLinkV2 = {
    id: input.id,
    name,
    url,
    description,
    order: index,
    createdAt: input.now,
    updatedAt: input.now,
    ...(icon ? { icon } : {}),
  }
  links.splice(index, 0, site)
  const categories = before.categories.map((category, indexValue) =>
    indexValue === categoryIndex ? { ...category, links, updatedAt: input.now } : category,
  )
  return success(before, { ...before, categories }, 'site-added', input.now)
}

export function updateSite(document: NavConfigV2, input: UpdateSiteInput): WorkspaceMutationResult {
  const location = findSite(document, input.siteId)
  if (!location) return failure(document, 'SITE_NOT_FOUND', '未找到要编辑的网站。', 'siteId')
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp
  const current = document.categories[location.categoryIndex].links[location.siteIndex]
  const name = normalizeName(input.name ?? current.name)
  if (!name) return failure(document, 'INVALID_NAME', '网站名称长度必须为 1–80 个字符。', 'name')
  const url = normalizeUrl(input.url ?? current.url)
  if (!url) return failure(document, 'INVALID_URL', '网站 URL 必须是有效的 HTTP 或 HTTPS 地址。', 'url')
  const description = normalizeDescription(input.description ?? current.description)
  if (description === undefined) {
    return failure(document, 'INVALID_DESCRIPTION', '网站描述不能超过 240 个字符。', 'description')
  }
  const icon = input.icon === undefined ? current.icon : normalizeIcon(input.icon)
  if (
    name === current.name &&
    url === current.url &&
    description === current.description &&
    icon === current.icon
  ) {
    return failure(document, 'NO_CHANGE', '网站内容没有变化。')
  }

  const before = serializeNavConfigV2(document)
  const beforeCategory = before.categories[location.categoryIndex]
  const beforeSite = beforeCategory.links[location.siteIndex]
  const updatedSite: NavLinkV2 = {
    ...beforeSite,
    name,
    url,
    description,
    updatedAt: input.now,
    ...(icon ? { icon } : {}),
  }
  if (!icon) delete updatedSite.icon
  const links = beforeCategory.links.map((site, index) =>
    index === location.siteIndex ? updatedSite : site,
  )
  const categories = before.categories.map((category, index) =>
    index === location.categoryIndex ? { ...category, links, updatedAt: input.now } : category,
  )
  return success(before, { ...before, categories }, 'site-updated', input.now)
}

export function deleteSite(document: NavConfigV2, input: DeleteSiteInput): WorkspaceMutationResult {
  const location = findSite(document, input.siteId)
  if (!location) return failure(document, 'SITE_NOT_FOUND', '未找到要删除的网站。', 'siteId')
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp

  const before = serializeNavConfigV2(document)
  const categories = before.categories.map((category, categoryIndex) =>
    categoryIndex === location.categoryIndex
      ? {
          ...category,
          links: category.links.filter((_, siteIndex) => siteIndex !== location.siteIndex),
          updatedAt: input.now,
        }
      : category,
  )
  const candidate = withoutSiteReferences({ ...before, categories }, new Set([input.siteId]))
  return success(before, candidate, 'site-deleted', input.now)
}

export function reorderSites(
  document: NavConfigV2,
  input: ReorderSitesInput,
): WorkspaceMutationResult {
  const categoryIndex = document.categories.findIndex((category) => category.id === input.categoryId)
  if (categoryIndex < 0) {
    return failure(document, 'CATEGORY_NOT_FOUND', '未找到要排序的网站分类。', 'categoryId')
  }
  const siteIndex = document.categories[categoryIndex].links.findIndex((site) => site.id === input.siteId)
  if (siteIndex < 0) return failure(document, 'SITE_NOT_FOUND', '分类中不存在该网站。', 'siteId')
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp
  if (!validIndex(input.toIndex, document.categories[categoryIndex].links.length - 1)) {
    return failure(document, 'INVALID_INDEX', '网站目标位置超出有效范围。', 'index')
  }
  if (siteIndex === input.toIndex) return failure(document, 'NO_CHANGE', '网站位置没有变化。')

  const before = serializeNavConfigV2(document)
  const category = before.categories[categoryIndex]
  const links = moveItem(category.links, siteIndex, input.toIndex).map((site) =>
    site.id === input.siteId ? { ...site, updatedAt: input.now } : site,
  )
  const categories = before.categories.map((candidate, index) =>
    index === categoryIndex ? { ...candidate, links, updatedAt: input.now } : candidate,
  )
  return success(before, { ...before, categories }, 'sites-reordered', input.now)
}

export function moveSite(document: NavConfigV2, input: MoveSiteInput): WorkspaceMutationResult {
  const targetCategoryIndex = document.categories.findIndex(
    (category) => category.id === input.toCategoryId,
  )
  if (targetCategoryIndex < 0) {
    return failure(document, 'CATEGORY_NOT_FOUND', '未找到网站目标分类。', 'categoryId')
  }
  const location = findSite(document, input.siteId)
  if (!location) return failure(document, 'SITE_NOT_FOUND', '未找到要移动的网站。', 'siteId')
  const invalidTimestamp = timestampFailure(document, input.now)
  if (invalidTimestamp) return invalidTimestamp

  if (location.categoryIndex === targetCategoryIndex) {
    const reordered = reorderSites(document, {
      categoryId: input.toCategoryId,
      siteId: input.siteId,
      toIndex: input.toIndex,
      now: input.now,
    })
    return reordered.ok ? { ...reordered, kind: 'site-moved' } : reordered
  }
  if (!validIndex(input.toIndex, document.categories[targetCategoryIndex].links.length)) {
    return failure(document, 'INVALID_INDEX', '网站目标位置超出有效范围。', 'index')
  }

  const before = serializeNavConfigV2(document)
  const source = before.categories[location.categoryIndex]
  const target = before.categories[targetCategoryIndex]
  const movedSite = { ...source.links[location.siteIndex], updatedAt: input.now }
  const sourceLinks = source.links.filter((_, index) => index !== location.siteIndex)
  const targetLinks = [...target.links]
  targetLinks.splice(input.toIndex, 0, movedSite)
  const categories = before.categories.map((category, index) => {
    if (index === location.categoryIndex) {
      return { ...category, links: sourceLinks, updatedAt: input.now }
    }
    if (index === targetCategoryIndex) {
      return { ...category, links: targetLinks, updatedAt: input.now }
    }
    return category
  })
  return success(before, { ...before, categories }, 'site-moved', input.now)
}

export function restoreWorkspaceSnapshot(snapshot: NavConfigV2): NavConfigV2 {
  return serializeNavConfigV2(snapshot)
}
