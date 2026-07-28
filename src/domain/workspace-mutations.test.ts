import { describe, expect, it } from 'vitest'

import type {
  ISODateTime,
  NavConfigV2,
  ToolId,
  UUID,
} from '../types/workspace'
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
} from './workspace-mutations'

const CREATED_AT = '2026-07-28T00:00:00.000Z' as ISODateTime
const CHANGED_AT = '2026-07-28T01:00:00.000Z' as ISODateTime

function uuid(value: number): UUID {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}` as UUID
}

function toolId(value: string): ToolId {
  return value as ToolId
}

function createDocument(): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: uuid(1),
    revision: 7,
    updatedAt: CREATED_AT,
    categories: [
      {
        id: uuid(2),
        name: '开发',
        order: 0,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        extensions: { color: 'blue' },
        links: [
          {
            id: uuid(10),
            name: 'GitHub',
            url: 'https://github.com',
            description: '代码托管',
            icon: 'https://github.com/favicon.ico',
            order: 0,
            createdAt: CREATED_AT,
            updatedAt: CREATED_AT,
            extensions: { tags: ['git'] },
          },
          {
            id: uuid(11),
            name: 'MDN',
            url: 'https://developer.mozilla.org',
            description: 'Web 文档',
            order: 1,
            createdAt: CREATED_AT,
            updatedAt: CREATED_AT,
          },
        ],
      },
      {
        id: uuid(3),
        name: '部署',
        order: 1,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        links: [
          {
            id: uuid(12),
            name: 'Cloudflare',
            url: 'https://cloudflare.com',
            description: '边缘平台',
            order: 0,
            createdAt: CREATED_AT,
            updatedAt: CREATED_AT,
          },
        ],
      },
    ],
    favorites: [
      { ref: { kind: 'site', id: uuid(10) }, createdAt: CREATED_AT },
      { ref: { kind: 'site', id: uuid(12) }, createdAt: CREATED_AT },
      { ref: { kind: 'tool', id: toolId('json') }, createdAt: CREATED_AT },
    ],
    recents: [
      { ref: { kind: 'site', id: uuid(10) }, openedAt: CREATED_AT },
      { ref: { kind: 'site', id: uuid(12) }, openedAt: CREATED_AT },
      { ref: { kind: 'tool', id: toolId('json') }, openedAt: CREATED_AT },
    ],
    extensions: { density: 'compact' },
  }
}

function expectSuccess(
  result: WorkspaceMutationResult,
): asserts result is Extract<WorkspaceMutationResult, { ok: true }> {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(`Expected mutation success, received ${result.error.code}`)
}

function expectFailure(result: WorkspaceMutationResult, code: string): void {
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.error.code).toBe(code)
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.getOwnPropertyNames(value).forEach((key) => {
      deepFreeze((value as Record<string, unknown>)[key])
    })
    Object.freeze(value)
  }
  return value
}

describe('category mutations', () => {
  it('adds a category with a caller-provided stable ID and a complete undo snapshot', () => {
    const original = deepFreeze(createDocument())
    const serializedBefore = JSON.stringify(original)

    const result = addCategory(original, {
      id: uuid(4),
      name: '  设计  ',
      index: 1,
      now: CHANGED_AT,
    })

    expectSuccess(result)
    expect(result.kind).toBe('category-added')
    expect(result.document.categories.map((category) => category.id)).toEqual([
      uuid(2),
      uuid(4),
      uuid(3),
    ])
    expect(result.document.categories.map((category) => category.order)).toEqual([0, 1, 2])
    expect(result.document.categories[1]).toMatchObject({
      id: uuid(4),
      name: '设计',
      createdAt: CHANGED_AT,
      updatedAt: CHANGED_AT,
      links: [],
    })
    expect(result.before).toEqual(original)
    expect(result.before).not.toBe(original)
    expect(result.before.categories).not.toBe(original.categories)
    expect(JSON.stringify(original)).toBe(serializedBefore)
    expect(result.document.revision).toBe(original.revision)
    expect(result.document.updatedAt).toBe(original.updatedAt)
  })

  it('updates a category by stable ID while preserving identity and extensions', () => {
    const original = createDocument()

    const result = updateCategory(original, {
      categoryId: uuid(2),
      name: '  工程资源  ',
      now: CHANGED_AT,
    })

    expectSuccess(result)
    expect(result.document.categories[0]).toMatchObject({
      id: uuid(2),
      name: '工程资源',
      createdAt: CREATED_AT,
      updatedAt: CHANGED_AT,
      extensions: { color: 'blue' },
    })
    expect(result.document.categories[0].links.map((link) => link.id)).toEqual([uuid(10), uuid(11)])
    expect(original.categories[0].name).toBe('开发')
  })

  it('deletes a non-empty category, cleans only its site references, and restores from before', () => {
    const original = createDocument()

    const result = deleteCategory(original, { categoryId: uuid(2), now: CHANGED_AT })

    expectSuccess(result)
    expect(result.kind).toBe('category-deleted')
    expect(result.document.categories).toHaveLength(1)
    expect(result.document.categories[0]).toMatchObject({ id: uuid(3), order: 0 })
    expect(result.document.favorites.map((favorite) => favorite.ref)).toEqual([
      { kind: 'site', id: uuid(12) },
      { kind: 'tool', id: toolId('json') },
    ])
    expect(result.document.recents.map((recent) => recent.ref)).toEqual([
      { kind: 'site', id: uuid(12) },
      { kind: 'tool', id: toolId('json') },
    ])

    const restored = restoreWorkspaceSnapshot(result.before)
    expect(restored).toEqual(original)
    expect(restored).not.toBe(result.before)
    expect(restored.categories[0].links).not.toBe(result.before.categories[0].links)
  })

  it('rejects duplicate IDs, invalid names, missing categories, and no-op edits without mutation', () => {
    const original = createDocument()
    const snapshot = structuredClone(original)

    expectFailure(
      addCategory(original, { id: uuid(10), name: 'Duplicate', now: CHANGED_AT }),
      'DUPLICATE_ID',
    )
    expectFailure(
      addCategory(original, { id: uuid(4), name: ' ', now: CHANGED_AT }),
      'INVALID_NAME',
    )
    expectFailure(
      updateCategory(original, { categoryId: uuid(999), name: 'Missing', now: CHANGED_AT }),
      'CATEGORY_NOT_FOUND',
    )
    expectFailure(
      updateCategory(original, { categoryId: uuid(2), name: '开发', now: CHANGED_AT }),
      'NO_CHANGE',
    )
    expectFailure(
      addCategory(original, { id: 'invalid' as UUID, name: 'Invalid ID', now: CHANGED_AT }),
      'INVALID_ID',
    )
    expectFailure(
      addCategory(original, { id: uuid(4), name: 'Index', index: 99, now: CHANGED_AT }),
      'INVALID_INDEX',
    )
    expectFailure(
      deleteCategory(original, { categoryId: uuid(999), now: CHANGED_AT }),
      'CATEGORY_NOT_FOUND',
    )
    expect(original).toEqual(snapshot)
  })
})

describe('site mutations', () => {
  it('adds a normalized safe site at an explicit sibling index', () => {
    const original = createDocument()

    const result = addSite(original, {
      categoryId: uuid(3),
      id: uuid(13),
      name: '  Vite  ',
      url: '  HTTPS://VITE.DEV/guide  ',
      description: '  构建工具  ',
      icon: '  https://vite.dev/logo.svg  ',
      index: 0,
      now: CHANGED_AT,
    })

    expectSuccess(result)
    expect(result.document.categories[1].links.map((link) => link.id)).toEqual([uuid(13), uuid(12)])
    expect(result.document.categories[1].links.map((link) => link.order)).toEqual([0, 1])
    expect(result.document.categories[1].links[0]).toMatchObject({
      id: uuid(13),
      name: 'Vite',
      url: 'HTTPS://VITE.DEV/guide',
      description: '构建工具',
      icon: 'https://vite.dev/logo.svg',
      createdAt: CHANGED_AT,
      updatedAt: CHANGED_AT,
    })
    expect(original.categories[1].links).toHaveLength(1)
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,bad',
    'file:///etc/passwd',
    'example.com/no-scheme',
    'https://safe.example.com\nhttps://evil.example.com',
  ])('rejects unsafe site URL %s without modifying the source', (url) => {
    const original = deepFreeze(createDocument())

    const result = addSite(original, {
      categoryId: uuid(2),
      id: uuid(13),
      name: 'Unsafe',
      url,
      now: CHANGED_AT,
    })

    expectFailure(result, 'INVALID_URL')
    expect(original.categories[0].links).toHaveLength(2)
  })

  it('updates a site without changing ID, creation time, extensions, favorites, or recents', () => {
    const original = createDocument()

    const result = updateSite(original, {
      siteId: uuid(10),
      name: '  GitHub Docs  ',
      url: 'https://docs.github.com',
      description: '  文档  ',
      icon: null,
      now: CHANGED_AT,
    })

    expectSuccess(result)
    const updated = result.document.categories[0].links[0]
    expect(updated).toMatchObject({
      id: uuid(10),
      name: 'GitHub Docs',
      url: 'https://docs.github.com',
      description: '文档',
      createdAt: CREATED_AT,
      updatedAt: CHANGED_AT,
      extensions: { tags: ['git'] },
    })
    expect(updated).not.toHaveProperty('icon')
    expect(result.document.favorites).toEqual(original.favorites)
    expect(result.document.recents).toEqual(original.recents)
    expect(original.categories[0].links[0].name).toBe('GitHub')
  })

  it('deletes a site by ID, cleans its references, and normalizes sibling order', () => {
    const original = createDocument()

    const result = deleteSite(original, { siteId: uuid(10), now: CHANGED_AT })

    expectSuccess(result)
    expect(result.document.categories[0].links).toEqual([
      expect.objectContaining({ id: uuid(11), order: 0 }),
    ])
    expect(result.document.favorites.map((favorite) => favorite.ref)).not.toContainEqual({
      kind: 'site',
      id: uuid(10),
    })
    expect(result.document.recents.map((recent) => recent.ref)).not.toContainEqual({
      kind: 'site',
      id: uuid(10),
    })
    expect(result.before).toEqual(original)
  })

  it('rejects duplicate IDs, invalid fields, missing sites, and unsafe edits', () => {
    const original = createDocument()

    expectFailure(
      addSite(original, {
        categoryId: uuid(2),
        id: uuid(3),
        name: 'Duplicate',
        url: 'https://example.com',
        now: CHANGED_AT,
      }),
      'DUPLICATE_ID',
    )
    expectFailure(
      addSite(original, {
        categoryId: uuid(999),
        id: uuid(13),
        name: 'Missing category',
        url: 'https://example.com',
        now: CHANGED_AT,
      }),
      'CATEGORY_NOT_FOUND',
    )
    expectFailure(
      updateSite(original, { siteId: uuid(10), url: 'javascript:alert(1)', now: CHANGED_AT }),
      'INVALID_URL',
    )
    expectFailure(
      updateSite(original, { siteId: uuid(999), name: 'Missing', now: CHANGED_AT }),
      'SITE_NOT_FOUND',
    )
    expectFailure(
      updateSite(original, { siteId: uuid(10), name: 'GitHub', now: CHANGED_AT }),
      'NO_CHANGE',
    )
    expectFailure(
      deleteSite(original, { siteId: uuid(999), now: CHANGED_AT }),
      'SITE_NOT_FOUND',
    )

    const unsafeLegacy = createDocument()
    unsafeLegacy.categories[0].links[0].url = 'javascript:alert(1)'
    expectFailure(
      updateSite(unsafeLegacy, { siteId: uuid(10), name: 'Still unsafe', now: CHANGED_AT }),
      'INVALID_URL',
    )
  })
})

describe('ordering and movement', () => {
  it('reorders categories by stable ID and keeps continuous sibling order', () => {
    const original = deepFreeze(createDocument())

    const result = reorderCategories(original, {
      categoryId: uuid(2),
      toIndex: 1,
      now: CHANGED_AT,
    })

    expectSuccess(result)
    expect(result.document.categories.map((category) => category.id)).toEqual([uuid(3), uuid(2)])
    expect(result.document.categories.map((category) => category.order)).toEqual([0, 1])
    expect(result.document.categories[1].updatedAt).toBe(CHANGED_AT)
    expect(original.categories.map((category) => category.id)).toEqual([uuid(2), uuid(3)])
  })

  it('reorders sites only inside the requested category', () => {
    const original = createDocument()

    const result = reorderSites(original, {
      categoryId: uuid(2),
      siteId: uuid(10),
      toIndex: 1,
      now: CHANGED_AT,
    })

    expectSuccess(result)
    expect(result.document.categories[0].links.map((link) => link.id)).toEqual([uuid(11), uuid(10)])
    expect(result.document.categories[0].links.map((link) => link.order)).toEqual([0, 1])
    expect(result.document.categories[1]).toEqual(original.categories[1])
  })

  it('moves a site across categories without changing ID or resource references', () => {
    const original = deepFreeze(createDocument())

    const result = moveSite(original, {
      siteId: uuid(10),
      toCategoryId: uuid(3),
      toIndex: 1,
      now: CHANGED_AT,
    })

    expectSuccess(result)
    expect(result.kind).toBe('site-moved')
    expect(result.document.categories[0].links.map((link) => link.id)).toEqual([uuid(11)])
    expect(result.document.categories[0].links.map((link) => link.order)).toEqual([0])
    expect(result.document.categories[1].links.map((link) => link.id)).toEqual([uuid(12), uuid(10)])
    expect(result.document.categories[1].links.map((link) => link.order)).toEqual([0, 1])
    expect(result.document.categories[1].links[1]).toMatchObject({
      id: uuid(10),
      createdAt: CREATED_AT,
      updatedAt: CHANGED_AT,
      extensions: { tags: ['git'] },
    })
    expect(result.document.favorites).toEqual(original.favorites)
    expect(result.document.recents).toEqual(original.recents)
    expect(result.before).toEqual(original)
  })

  it('uses reorder semantics when moving inside the same category', () => {
    const result = moveSite(createDocument(), {
      siteId: uuid(10),
      toCategoryId: uuid(2),
      toIndex: 1,
      now: CHANGED_AT,
    })

    expectSuccess(result)
    expect(result.kind).toBe('site-moved')
    expect(result.document.categories[0].links.map((link) => link.id)).toEqual([uuid(11), uuid(10)])
  })

  it('rejects missing IDs, invalid indices, and no-op ordering', () => {
    const original = createDocument()

    expectFailure(
      reorderCategories(original, { categoryId: uuid(999), toIndex: 0, now: CHANGED_AT }),
      'CATEGORY_NOT_FOUND',
    )
    expectFailure(
      reorderCategories(original, { categoryId: uuid(2), toIndex: -1, now: CHANGED_AT }),
      'INVALID_INDEX',
    )
    expectFailure(
      reorderCategories(original, { categoryId: uuid(2), toIndex: 0, now: CHANGED_AT }),
      'NO_CHANGE',
    )
    expectFailure(
      reorderSites(original, {
        categoryId: uuid(2),
        siteId: uuid(12),
        toIndex: 0,
        now: CHANGED_AT,
      }),
      'SITE_NOT_FOUND',
    )
    expectFailure(
      reorderSites(original, {
        categoryId: uuid(2),
        siteId: uuid(10),
        toIndex: 0,
        now: CHANGED_AT,
      }),
      'NO_CHANGE',
    )
    expectFailure(
      reorderSites(original, {
        categoryId: uuid(2),
        siteId: uuid(10),
        toIndex: 9,
        now: CHANGED_AT,
      }),
      'INVALID_INDEX',
    )
    expectFailure(
      moveSite(original, {
        siteId: uuid(10),
        toCategoryId: uuid(999),
        toIndex: 0,
        now: CHANGED_AT,
      }),
      'CATEGORY_NOT_FOUND',
    )
    expectFailure(
      moveSite(original, {
        siteId: uuid(999),
        toCategoryId: uuid(2),
        toIndex: 0,
        now: CHANGED_AT,
      }),
      'SITE_NOT_FOUND',
    )
    expectFailure(
      moveSite(original, {
        siteId: uuid(10),
        toCategoryId: uuid(3),
        toIndex: 9,
        now: CHANGED_AT,
      }),
      'INVALID_INDEX',
    )
  })
})
