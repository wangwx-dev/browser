import { describe, expect, it, vi } from 'vitest'

import type { ISODateTime, NavConfigV2, UUID } from '../types/workspace'
import {
  isSafeNavigationUrl,
  normalizeNavConfig,
  parseRemoteDocument,
  serializeNavConfigV1,
  serializeNavConfigV2,
} from './nav-config'

const ids = {
  config: '00000000-0000-4000-8000-000000000001',
  categoryOne: '00000000-0000-4000-8000-000000000002',
  categoryTwo: '00000000-0000-4000-8000-000000000003',
  linkOne: '00000000-0000-4000-8000-000000000004',
  linkTwo: '00000000-0000-4000-8000-000000000005',
  nextConfig: '00000000-0000-4000-8000-000000000006',
} as const

const timestamp = '2026-07-28T02:03:04.000Z'

function uuid(value: string): UUID {
  return value as UUID
}

function isoDateTime(value: string): ISODateTime {
  return value as ISODateTime
}

function createValidV2(): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: uuid(ids.config),
    revision: 3,
    updatedAt: isoDateTime(timestamp),
    categories: [
      {
        id: uuid(ids.categoryOne),
        name: '常用',
        order: 0,
        createdAt: isoDateTime(timestamp),
        updatedAt: isoDateTime(timestamp),
        links: [
          {
            id: uuid(ids.linkOne),
            name: 'GitHub',
            url: 'https://github.com',
            description: '代码托管',
            icon: 'https://github.com/favicon.ico',
            order: 0,
            createdAt: isoDateTime(timestamp),
            updatedAt: isoDateTime(timestamp),
          },
        ],
      },
    ],
    favorites: [
      {
        ref: { kind: 'site', id: uuid(ids.linkOne) },
        createdAt: isoDateTime(timestamp),
      },
    ],
    recents: [
      {
        ref: { kind: 'site', id: uuid(ids.linkOne) },
        openedAt: isoDateTime(timestamp),
      },
    ],
    extensions: { density: 'compact' },
  }
}

function createV1() {
  return [
    {
      category: '常用工具',
      color: 'blue',
      links: [
        {
          name: 'GitHub',
          url: 'https://github.com',
          desc: '代码托管平台',
          icon: 'https://github.com/favicon.ico',
          tags: ['code', 'git'],
        },
        {
          name: 'Cloudflare',
          url: 'https://cloudflare.com',
          desc: '边缘平台',
        },
      ],
    },
  ]
}

describe('parseRemoteDocument', () => {
  it('should adapt v1 once with stable IDs, continuous orders and one shared timestamp', () => {
    const generatedIds = [ids.config, ids.categoryOne, ids.linkOne, ids.linkTwo]
    const newId = vi.fn(() => generatedIds.shift()!)
    const now = vi.fn(() => timestamp)

    const result = parseRemoteDocument(createV1(), { newId, now })

    expect(result.kind).toBe('adapted-v1')
    if (result.kind !== 'adapted-v1') return
    expect(result.document).toMatchObject({
      schemaVersion: 2,
      configId: ids.config,
      revision: 1,
      updatedAt: timestamp,
      favorites: [],
      recents: [],
      categories: [
        {
          id: ids.categoryOne,
          name: '常用工具',
          order: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          extensions: { color: 'blue' },
          links: [
            {
              id: ids.linkOne,
              name: 'GitHub',
              description: '代码托管平台',
              order: 0,
              createdAt: timestamp,
              updatedAt: timestamp,
              extensions: { tags: ['code', 'git'] },
            },
            {
              id: ids.linkTwo,
              name: 'Cloudflare',
              description: '边缘平台',
              order: 1,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        },
      ],
    })
    expect(result.shadow.sourceFingerprint).toBe(result.sourceFingerprint)
    expect(result.shadow.document).toEqual(result.document)
    expect(result.shadow.document).not.toBe(result.document)
    expect(result.shadow.document.categories).not.toBe(result.document.categories)
    expect(newId).toHaveBeenCalledTimes(4)
    expect(now).toHaveBeenCalledTimes(1)
  })

  it('should preserve duplicate category names and URLs while assigning unique entity IDs', () => {
    const raw = [
      { category: '重复', links: [{ name: 'Same', url: 'https://example.com', desc: 'one' }] },
      { category: '重复', links: [{ name: 'Same', url: 'https://example.com', desc: 'two' }] },
    ]
    const generatedIds = [
      ids.config,
      ids.categoryOne,
      ids.linkOne,
      ids.categoryTwo,
      ids.linkTwo,
    ]

    const result = parseRemoteDocument(raw, {
      newId: () => generatedIds.shift()!,
      now: () => timestamp,
    })

    expect(result.kind).toBe('adapted-v1')
    if (result.kind !== 'adapted-v1') return
    expect(result.document.categories.map((category) => category.name)).toEqual(['重复', '重复'])
    expect(result.document.categories.flatMap((category) => category.links.map((link) => link.url))).toEqual([
      'https://example.com',
      'https://example.com',
    ])
    const entityIds = [
      result.document.configId,
      ...result.document.categories.flatMap((category) => [
        category.id,
        ...category.links.map((link) => link.id),
      ]),
    ]
    expect(new Set(entityIds).size).toBe(entityIds.length)
  })

  it('should reuse an existing shadow for the exact same v1 source without new randomness', () => {
    const generatedIds = [ids.config, ids.categoryOne, ids.linkOne, ids.linkTwo]
    const first = parseRemoteDocument(createV1(), {
      newId: () => generatedIds.shift()!,
      now: () => timestamp,
    })
    expect(first.kind).toBe('adapted-v1')
    if (first.kind !== 'adapted-v1') return
    const newId = vi.fn(() => {
      throw new Error('must not generate another ID')
    })
    const now = vi.fn(() => {
      throw new Error('must not generate another timestamp')
    })

    const second = parseRemoteDocument(createV1(), { shadow: first.shadow, newId, now })

    expect(second.kind).toBe('adapted-v1')
    if (second.kind !== 'adapted-v1') return
    expect(second.document).toEqual(first.document)
    expect(second.shadow).toEqual(first.shadow)
    expect(second.reused).toBe(true)
    expect(second.reusedShadow).toBe(true)
    expect(newId).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })

  it('should canonicalize object keys when comparing a v1 source fingerprint', () => {
    const firstRaw = [
      {
        category: 'A',
        alpha: 1,
        links: [{ name: 'Site', url: 'https://example.com', desc: '', zeta: 2, beta: 3 }],
      },
    ]
    const reorderedRaw = [
      {
        links: [{ beta: 3, zeta: 2, desc: '', url: 'https://example.com', name: 'Site' }],
        alpha: 1,
        category: 'A',
      },
    ]
    const generatedIds = [ids.config, ids.categoryOne, ids.linkOne]
    const first = parseRemoteDocument(firstRaw, {
      newId: () => generatedIds.shift()!,
      now: timestamp,
    })
    expect(first.kind).toBe('adapted-v1')
    if (first.kind !== 'adapted-v1') return

    const second = parseRemoteDocument(reorderedRaw, { shadow: first.shadow })

    expect(second.kind).toBe('adapted-v1')
    if (second.kind !== 'adapted-v1') return
    expect(second.sourceFingerprint).toBe(first.sourceFingerprint)
    expect(second.reused).toBe(true)
  })

  it('should stop with legacy-changed when a v1 source no longer matches its shadow', () => {
    const generatedIds = [ids.config, ids.categoryOne, ids.linkOne, ids.linkTwo]
    const first = parseRemoteDocument(createV1(), {
      newId: () => generatedIds.shift()!,
      now: () => timestamp,
    })
    expect(first.kind).toBe('adapted-v1')
    if (first.kind !== 'adapted-v1') return
    const changed = createV1()
    changed[0].links[0].name = 'GitHub changed remotely'

    const result = parseRemoteDocument(changed, {
      shadow: first.shadow,
      newId: vi.fn(() => ids.nextConfig),
      now: vi.fn(() => timestamp),
    })

    expect(result.kind).toBe('legacy-changed')
    expect('document' in result).toBe(false)
    if (result.kind !== 'legacy-changed') return
    expect(result.sourceFingerprint).not.toBe(first.sourceFingerprint)
    expect(result.previousFingerprint).toBe(first.sourceFingerprint)
    expect(result.previous).toEqual(first.shadow)
    expect(result.previous).not.toBe(first.shadow)
  })

  it('should validate and deep-clone a valid v2 document without invoking legacy generators', () => {
    const raw = createValidV2()
    const newId = vi.fn(() => ids.nextConfig)
    const now = vi.fn(() => timestamp)

    const result = parseRemoteDocument(raw, { newId, now })

    expect(result).toEqual({ kind: 'valid-v2', document: raw, warnings: [] })
    if (result.kind !== 'valid-v2') return
    expect(result.document).not.toBe(raw)
    expect(result.document.categories).not.toBe(raw.categories)
    expect(newId).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })

  it('should move safe unknown JSON into extensions using deep copies', () => {
    const metadata = { labels: ['work'] }
    const raw = {
      ...createValidV2(),
      futureRootSetting: { feature: true },
      categories: [
        {
          ...createValidV2().categories[0],
          accent: '#38bdf8',
          links: [
            {
              ...createValidV2().categories[0].links[0],
              metadata,
            },
          ],
        },
      ],
    }

    const result = parseRemoteDocument(raw)

    expect(result.kind).toBe('valid-v2')
    if (result.kind !== 'valid-v2') return
    expect(result.document.extensions).toEqual({
      density: 'compact',
      futureRootSetting: { feature: true },
    })
    expect(result.document.categories[0].extensions).toEqual({ accent: '#38bdf8' })
    expect(result.document.categories[0].links[0].extensions).toEqual({ metadata })
    expect(result.document.categories[0].links[0].extensions?.metadata).not.toBe(metadata)
  })

  it('should reject prototype-pollution extension keys and emit a warning', () => {
    const raw = JSON.parse(JSON.stringify(createValidV2())) as Record<string, unknown>
    const category = (raw.categories as Array<Record<string, unknown>>)[0]
    const link = (category.links as Array<Record<string, unknown>>)[0]
    Object.defineProperty(raw, '__proto__', { enumerable: true, value: { polluted: true } })
    Object.defineProperty(category, 'constructor', { enumerable: true, value: { bad: true } })
    Object.defineProperty(link, 'prototype', { enumerable: true, value: { bad: true } })

    const result = parseRemoteDocument(raw)

    expect(result.kind).toBe('valid-v2')
    if (result.kind !== 'valid-v2') return
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'unsafe-extension-key',
      'unsafe-extension-key',
      'unsafe-extension-key',
    ])
    expect(Object.hasOwn(result.document.extensions ?? {}, '__proto__')).toBe(false)
    expect(Object.hasOwn(result.document.categories[0].extensions ?? {}, 'constructor')).toBe(false)
    expect(Object.hasOwn(result.document.categories[0].links[0].extensions ?? {}, 'prototype')).toBe(
      false,
    )
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it.each([null, 'not-a-document', 42, { schemaVersion: 1 }])(
    'should reject an invalid top level without manufacturing an empty document: %j',
    (raw) => {
      const result = parseRemoteDocument(raw)

      expect(result.kind).toBe('invalid')
      expect('document' in result).toBe(false)
      if (result.kind === 'invalid') expect(result.issues.length).toBeGreaterThan(0)
    },
  )

  it('should reject sparse arrays and non-JSON legacy fields', () => {
    const sparse = new Array(1)
    const nonJson = [{ category: 'A', links: [], callback: () => undefined }]
    const namedArrayProperty = createV1()
    Object.assign(namedArrayProperty, { metadata: true })

    expect(parseRemoteDocument(sparse).kind).toBe('invalid')
    expect(parseRemoteDocument(nonJson).kind).toBe('invalid')
    expect(parseRemoteDocument(namedArrayProperty).kind).toBe('invalid')
  })

  it('should never downgrade a malformed schemaVersion 2 object to legacy adaptation', () => {
    const newId = vi.fn(() => ids.nextConfig)
    const now = vi.fn(() => timestamp)

    const result = parseRemoteDocument({ schemaVersion: 2, categories: [] }, { newId, now })

    expect(result.kind).toBe('invalid')
    expect(newId).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })

  it.each([
    [{ category: 'Broken', links: {} }],
    [{ category: 'Broken', links: [{ name: 7, url: 'https://example.com' }] }],
    {
      ...createValidV2(),
      categories: [{ ...createValidV2().categories[0], links: 'broken' }],
    },
    { ...createValidV2(), favorites: [{ ref: { kind: 'site' }, createdAt: timestamp }] },
  ])('should reject malformed nested data atomically', (raw) => {
    const result = parseRemoteDocument(raw)

    expect(result.kind).toBe('invalid')
    expect('document' in result).toBe(false)
  })

  it('should reject malformed and duplicate entity UUIDs', () => {
    const malformed = {
      ...createValidV2(),
      categories: [{ ...createValidV2().categories[0], id: 'category-1' }],
    }
    const duplicate = {
      ...createValidV2(),
      categories: [{ ...createValidV2().categories[0], id: ids.config }],
    }

    expect(parseRemoteDocument(malformed).kind).toBe('invalid')
    expect(parseRemoteDocument(duplicate).kind).toBe('invalid')
  })

  it.each([
    { ...createValidV2(), revision: 0 },
    { ...createValidV2(), revision: 1.5 },
    { ...createValidV2(), updatedAt: '2026-07-28' },
    {
      ...createValidV2(),
      categories: [{ ...createValidV2().categories[0], order: 4 }],
    },
    {
      ...createValidV2(),
      categories: [
        {
          ...createValidV2().categories[0],
          links: [{ ...createValidV2().categories[0].links[0], order: -1 }],
        },
      ],
    },
  ])('should strictly reject invalid revision, timestamp or non-continuous order', (raw) => {
    expect(parseRemoteDocument(raw).kind).toBe('invalid')
  })

  it('should never mutate v1, v2 or shadow input objects', () => {
    const v1 = createV1()
    const v2 = createValidV2()
    const generatedIds = [ids.config, ids.categoryOne, ids.linkOne, ids.linkTwo]
    const adapted = parseRemoteDocument(v1, {
      newId: () => generatedIds.shift()!,
      now: () => timestamp,
    })
    expect(adapted.kind).toBe('adapted-v1')
    if (adapted.kind !== 'adapted-v1') return
    const v1Snapshot = JSON.stringify(v1)
    const v2Snapshot = JSON.stringify(v2)
    const shadowSnapshot = JSON.stringify(adapted.shadow)

    parseRemoteDocument(v1, { shadow: adapted.shadow })
    parseRemoteDocument(v2)

    expect(JSON.stringify(v1)).toBe(v1Snapshot)
    expect(JSON.stringify(v2)).toBe(v2Snapshot)
    expect(JSON.stringify(adapted.shadow)).toBe(shadowSnapshot)
  })
})

describe('serialization contracts', () => {
  it('should serialize v2 to JSON-safe data that round-trips through the parser', () => {
    const document = createValidV2()

    const serialized = serializeNavConfigV2(document)
    const transported = JSON.parse(JSON.stringify(serialized)) as unknown
    const reparsed = parseRemoteDocument(transported)

    expect(transported).toEqual(serialized)
    expect(reparsed).toEqual({ kind: 'valid-v2', document, warnings: [] })
    expect(serialized).not.toBe(document)
  })

  it('should normalize sibling orders explicitly without modifying the source document', () => {
    const source = createValidV2()
    source.categories[0].order = 8
    source.categories[0].links[0].order = -2

    const normalized = normalizeNavConfig(source)

    expect(normalized.categories[0].order).toBe(0)
    expect(normalized.categories[0].links[0].order).toBe(0)
    expect(source.categories[0].order).toBe(8)
    expect(source.categories[0].links[0].order).toBe(-2)
  })

  it('should serialize v1 explicitly and report stable ID, favorite and recent losses', () => {
    const document = createValidV2()
    document.categories[0].extensions = { color: 'blue' }
    document.categories[0].links[0].extensions = { tags: ['git'] }

    const result = serializeNavConfigV1(document)

    expect(result.raw).toEqual([
      {
        category: '常用',
        color: 'blue',
        links: [
          {
            name: 'GitHub',
            url: 'https://github.com',
            desc: '代码托管',
            icon: 'https://github.com/favicon.ico',
            tags: ['git'],
          },
        ],
      },
    ])
    expect(result.losses).toEqual([
      { kind: 'stable-ids', count: 3 },
      { kind: 'favorites', count: 1 },
      { kind: 'recents', count: 1 },
      { kind: 'root-extensions', count: 1 },
    ])
    expect(result.lostCapabilities).toEqual(['stable-ids', 'favorites', 'recents'])
  })
})

describe('isSafeNavigationUrl', () => {
  it.each(['https://example.com', 'http://localhost:5173/path', '  HTTPS://EXAMPLE.COM/path  '])('should accept %s', (url) => {
    expect(isSafeNavigationUrl(url)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/test',
    'vbscript:msgbox(1)',
    '//example.com',
    '/relative',
    'https://exa\nmple.com',
  ]) (
    'should reject %s',
    (url) => {
      expect(isSafeNavigationUrl(url)).toBe(false)
    },
  )
})
