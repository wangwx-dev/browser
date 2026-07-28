import { describe, expect, it, vi } from 'vitest'

import type { ToolDefinition } from '../config/tools'
import type {
  ISODateTime,
  NavCategoryV2,
  SafeHttpUrl,
  ToolId,
  UUID,
} from '../types/workspace'
import {
  buildCommandIndex,
  buildRankingContext,
  commandKeyForRef,
  createCommandIndex,
  normalizeSearchQuery,
  searchCommands,
  type CommandKey,
  type RankingContext,
  type SearchCommand,
} from './search'

const NOW = Date.parse('2026-07-28T00:00:00.000Z')
const TIMESTAMP = '2026-07-28T00:00:00.000Z' as ISODateTime

function uuid(value: number): UUID {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}` as UUID
}

function toolId(value: string): ToolId {
  return value as ToolId
}

function safeUrl(value: string): SafeHttpUrl {
  return value as SafeHttpUrl
}

function rankingContext(overrides: Partial<RankingContext> = {}): RankingContext {
  return {
    favoriteKeys: new Set<CommandKey>(),
    latestOpenedAt: new Map<CommandKey, number>(),
    now: NOW,
    ...overrides,
  }
}

function toolCommand(
  id: string,
  overrides: Partial<SearchCommand> = {},
): SearchCommand {
  const brandedId = toolId(id)
  return {
    key: `tool:${id}`,
    ref: { kind: 'tool', id: brandedId },
    kind: 'tool',
    title: id,
    aliases: [],
    description: '',
    category: '',
    keywords: [],
    sourceOrder: 0,
    action: { type: 'open-tool', path: `/tools/${id}` },
    ...overrides,
  }
}

function siteCommand(id: number, overrides: Partial<SearchCommand> = {}): SearchCommand {
  const brandedId = uuid(id)
  const url = safeUrl(`https://site-${id}.example.com`)
  return {
    key: `site:${brandedId}`,
    ref: { kind: 'site', id: brandedId },
    kind: 'site',
    title: `Site ${id}`,
    aliases: [],
    description: '',
    category: '',
    keywords: [],
    searchableUrl: url,
    sourceOrder: id,
    action: { type: 'open-site', url },
    ...overrides,
  }
}

function makeTool(
  id: string,
  load: ToolDefinition['load'],
  overrides: Partial<ToolDefinition> = {},
): ToolDefinition {
  return {
    id: toolId(id),
    order: 0,
    path: `/tools/${id}`,
    title: id,
    aliases: [],
    description: '',
    category: '测试',
    iconKey: 'test',
    keywords: [],
    privacy: 'local-only',
    load,
    ...overrides,
  }
}

function makeCategory(links: NavCategoryV2['links']): NavCategoryV2 {
  return {
    id: uuid(9000),
    name: '网站',
    order: 0,
    links,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

describe('normalizeSearchQuery', () => {
  it('normalizes Unicode width, case and consecutive whitespace', () => {
    expect(normalizeSearchQuery('  ＪＳＯＮ　   Tool  ')).toBe('json tool')
  })
})

describe('buildCommandIndex', () => {
  it('does not invoke lazy tool loaders while indexing or searching', () => {
    const loader = vi.fn(async () => ({ default: () => null }))
    const index = buildCommandIndex({ tools: [makeTool('json', loader)], categories: [] })

    expect(searchCommands(index, 'json', rankingContext())).toHaveLength(1)
    expect(loader).not.toHaveBeenCalled()
  })

  it('filters dangerous websites, empty names and invalid tool routes', () => {
    const loader = vi.fn(async () => ({ default: () => null }))
    const category = makeCategory([
      {
        id: uuid(1),
        name: 'Danger',
        url: 'javascript:alert(1)',
        description: '',
        order: 0,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      {
        id: uuid(2),
        name: ' ',
        url: 'https://empty.example.com',
        description: '',
        order: 1,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
      {
        id: uuid(3),
        name: 'Safe',
        url: '  HTTPS://SAFE.EXAMPLE.COM/path  ',
        description: '',
        order: 2,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ])

    const index = buildCommandIndex({
      tools: [makeTool('bad', loader, { path: 'https://example.com/tool' })],
      categories: [category],
    })

    expect(index.commands.map((command) => command.title)).toEqual(['Safe'])
    expect(index.commands[0].action).toEqual({
      type: 'open-site',
      url: 'HTTPS://SAFE.EXAMPLE.COM/path',
    })
    expect(loader).not.toHaveBeenCalled()
  })

  it('uses kind-qualified keys so a site and tool with the same raw ID both remain', () => {
    const rawId = uuid(77)
    const site = siteCommand(77)
    const tool = toolCommand(rawId, {
      key: `tool:${rawId}`,
      ref: { kind: 'tool', id: rawId as unknown as ToolId },
      action: { type: 'open-tool', path: '/tools/shared-id' },
    })

    const index = createCommandIndex([site, tool])

    expect(index.commands.map((command) => command.key)).toEqual([
      `tool:${rawId}`,
      `site:${rawId}`,
    ])
  })

  it('uses explicit order rather than input array order', () => {
    const first = toolCommand('first', { title: 'Match first', sourceOrder: 0 })
    const second = toolCommand('second', { title: 'Match second', sourceOrder: 1 })

    const forward = searchCommands(createCommandIndex([first, second]), 'match', rankingContext())
    const reversed = searchCommands(createCommandIndex([second, first]), 'match', rankingContext())

    expect(forward.map((hit) => hit.command.key)).toEqual(reversed.map((hit) => hit.command.key))
  })
})

describe('searchCommands ranking', () => {
  it('orders the seven match tiers deterministically', () => {
    const commands = [
      toolCommand('tier-0', { title: 'json', sourceOrder: 6 }),
      toolCommand('tier-1', { title: 'json formatter', sourceOrder: 5 }),
      toolCommand('tier-2', { title: 'alias', aliases: ['json helper'], sourceOrder: 4 }),
      toolCommand('tier-3', { title: 'my json tool', sourceOrder: 3 }),
      toolCommand('tier-4', { title: 'keyword', keywords: ['my json keyword'], sourceOrder: 2 }),
      toolCommand('tier-5', { title: 'category', category: 'json utilities', sourceOrder: 1 }),
      toolCommand('tier-6', { title: 'description', description: 'handles json content', sourceOrder: 0 }),
    ]

    const hits = searchCommands(createCommandIndex(commands), 'json', rankingContext())

    expect(hits.map((hit) => hit.command.key)).toEqual(
      Array.from({ length: 7 }, (_, tier) => `tool:tier-${tier}`),
    )
    expect(hits.map((hit) => hit.match.tier)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('never lets favorite or recent context outrank a stronger text match', () => {
    const exact = toolCommand('exact', { title: 'json' })
    const weak = toolCommand('weak', { title: 'other', description: 'mentions json' })
    const context = rankingContext({
      favoriteKeys: new Set<CommandKey>([weak.key]),
      latestOpenedAt: new Map<CommandKey, number>([[weak.key, NOW]]),
    })

    const hits = searchCommands(createCommandIndex([weak, exact]), 'json', context)

    expect(hits.map((hit) => hit.command.key)).toEqual([exact.key, weak.key])
  })

  it('uses favorite, recency bucket, kind, source order and ASCII key as tie-breakers', () => {
    const favorite = toolCommand('favorite', { title: 'match favorite', sourceOrder: 9 })
    const recentTool = toolCommand('recent', { title: 'match recent', sourceOrder: 9 })
    const oldTool = toolCommand('old', { title: 'match old', sourceOrder: 9 })
    const site = siteCommand(8, { title: 'match site', sourceOrder: 0 })
    const context = rankingContext({
      favoriteKeys: new Set<CommandKey>([favorite.key]),
      latestOpenedAt: new Map<CommandKey, number>([
        [recentTool.key, NOW - 30 * 60 * 1000],
        [oldTool.key, NOW - 10 * 24 * 60 * 60 * 1000],
        [site.key, NOW - 30 * 60 * 1000],
      ]),
    })

    const hits = searchCommands(
      createCommandIndex([site, oldTool, recentTool, favorite]),
      'match',
      context,
    )

    expect(hits.map((hit) => hit.command.key)).toEqual([
      favorite.key,
      recentTool.key,
      site.key,
      oldTool.key,
    ])

    const asciiA = toolCommand('ascii-a', { title: 'same', sourceOrder: 3 })
    const asciiB = toolCommand('ascii-b', { title: 'same', sourceOrder: 3 })
    expect(
      searchCommands(createCommandIndex([asciiB, asciiA]), 'same', rankingContext()).map(
        (hit) => hit.command.key,
      ),
    ).toEqual([asciiA.key, asciiB.key])
  })

  it('assigns exact recency boundaries to the next bucket and future times to the newest bucket', () => {
    const times = [
      NOW + 1000,
      NOW - 60 * 60 * 1000,
      NOW - 24 * 60 * 60 * 1000,
      NOW - 7 * 24 * 60 * 60 * 1000,
      NOW - 30 * 24 * 60 * 60 * 1000,
    ]
    const commands = times.map((_, index) =>
      toolCommand(`bucket-${index}`, { title: `match ${index}`, sourceOrder: 99 - index }),
    )
    const context = rankingContext({
      latestOpenedAt: new Map<CommandKey, number>(
        commands.map((command, index) => [command.key, times[index]]),
      ),
    })

    expect(
      searchCommands(createCommandIndex([...commands].reverse()), 'match', context).map(
        (hit) => hit.command.key,
      ),
    ).toEqual(commands.map((command) => command.key))
  })

  it('returns an empty result for an empty normalized query', () => {
    const index = createCommandIndex([toolCommand('json', { title: 'JSON' })])

    expect(searchCommands(index, '  　 ', rankingContext())).toEqual([])
  })
})

describe('ranking context', () => {
  it('deduplicates recents by ref and keeps the latest valid timestamp', () => {
    const ref = { kind: 'tool' as const, id: toolId('json') }
    const key = commandKeyForRef(ref)
    const context = buildRankingContext({
      now: NOW,
      favorites: [
        { ref, createdAt: TIMESTAMP },
        { ref, createdAt: TIMESTAMP },
      ],
      recents: [
        { ref, openedAt: '2026-07-27T00:00:00.000Z' as ISODateTime },
        { ref, openedAt: 'invalid' as ISODateTime },
        { ref, openedAt: '2026-07-27T23:00:00.000Z' as ISODateTime },
      ],
    })

    expect(context.favoriteKeys).toEqual(new Set([key]))
    expect(context.latestOpenedAt.get(key)).toBe(Date.parse('2026-07-27T23:00:00.000Z'))
  })

  it('ignores dangling favorite and recent refs naturally when no command exists', () => {
    const key = 'tool:deleted' as CommandKey
    const context = rankingContext({
      favoriteKeys: new Set([key]),
      latestOpenedAt: new Map([[key, NOW]]),
    })

    expect(searchCommands(createCommandIndex([]), 'deleted', context)).toEqual([])
  })
})

describe('search performance and updates', () => {
  it('searches a 600-item prebuilt index below the 100ms p95 target', () => {
    const commands = Array.from({ length: 600 }, (_, index) =>
      index < 100
        ? toolCommand(`tool-${index}`, {
            title: `Developer tool ${index}`,
            description: index === 42 ? 'needle target' : 'utility',
            sourceOrder: index,
          })
        : siteCommand(index, {
            title: `Developer site ${index}`,
            description: index === 542 ? 'needle target' : 'documentation',
            sourceOrder: index,
          }),
    )
    const index = createCommandIndex(commands)
    const durations: number[] = []

    for (let iteration = 0; iteration < 30; iteration += 1) {
      const startedAt = performance.now()
      searchCommands(index, 'needle', rankingContext())
      durations.push(performance.now() - startedAt)
    }
    durations.sort((left, right) => left - right)
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1]

    expect(p95).toBeLessThan(100)
  })

  it('reflects a rebuilt resource index while ranking-only context changes need no rebuild', () => {
    const first = toolCommand('first', { title: 'target first' })
    const second = toolCommand('second', { title: 'target second' })
    const initial = createCommandIndex([first])
    const rebuilt = createCommandIndex([second])

    expect(searchCommands(initial, 'target', rankingContext())[0].command.key).toBe(first.key)
    expect(searchCommands(rebuilt, 'target', rankingContext())[0].command.key).toBe(second.key)

    const both = createCommandIndex([first, second])
    const favoriteContext = rankingContext({ favoriteKeys: new Set([second.key]) })
    expect(searchCommands(both, 'target', favoriteContext)[0].command.key).toBe(second.key)
  })
})
