import type { ToolDefinition } from '../config/tools'
import { isSafeNavigationUrl } from './nav-config'
import type {
  FavoriteV2,
  NavCategoryV2,
  RecentV2,
  ResourceRefV2,
  SafeHttpUrl,
  ToolId,
  UUID,
} from '../types/workspace'

export type CommandKey = `site:${string}` | `tool:${string}`

export interface SearchCommand {
  key: CommandKey
  ref: ResourceRefV2
  kind: 'site' | 'tool'
  title: string
  aliases: readonly string[]
  description: string
  category: string
  keywords: readonly string[]
  searchableUrl?: SafeHttpUrl
  sourceOrder: number
  action:
    | { type: 'open-site'; url: SafeHttpUrl }
    | { type: 'open-tool'; path: string }
}

export type SearchMatchTier = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type SearchMatchField = 'title' | 'alias' | 'keyword' | 'category' | 'url' | 'description'

export interface SearchHit {
  command: SearchCommand
  match: {
    tier: SearchMatchTier
    field: SearchMatchField
  }
}

export interface RankingContext {
  favoriteKeys: ReadonlySet<CommandKey>
  latestOpenedAt: ReadonlyMap<CommandKey, number>
  now: number
}

export interface BuildRankingContextInput {
  favorites?: readonly FavoriteV2[]
  recents?: readonly RecentV2[]
  now: number
}

interface NormalizedSearchFields {
  title: string
  aliases: readonly string[]
  description: string
  category: string
  keywords: readonly string[]
  url: string
}

export interface CommandIndex {
  commands: readonly SearchCommand[]
  normalizedByKey: ReadonlyMap<CommandKey, NormalizedSearchFields>
}

export function normalizeSearchQuery(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ')
}

export function commandKeyForRef(ref: ResourceRefV2): CommandKey {
  return `${ref.kind}:${ref.id}` as CommandKey
}

function asciiCompare(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function kindRank(kind: SearchCommand['kind']): number {
  return kind === 'tool' ? 0 : 1
}

function isInternalToolPath(path: string): boolean {
  return /^\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
}

function isValidCommand(command: SearchCommand): boolean {
  if (command.title.trim().length === 0 || !Number.isFinite(command.sourceOrder)) return false
  if (command.kind === 'site') {
    return command.action.type === 'open-site' && isSafeNavigationUrl(command.action.url)
  }
  return command.action.type === 'open-tool' && isInternalToolPath(command.action.path)
}

function normalizeCommand(command: SearchCommand): SearchCommand | undefined {
  if (!isValidCommand(command)) return undefined
  if (command.kind === 'site' && command.action.type === 'open-site') {
    const url = command.action.url.trim() as SafeHttpUrl
    return {
      ...command,
      title: command.title.trim(),
      description: command.description.trim(),
      category: command.category.trim(),
      aliases: command.aliases.map((value) => value.trim()).filter(Boolean),
      keywords: command.keywords.map((value) => value.trim()).filter(Boolean),
      searchableUrl: url,
      action: { type: 'open-site', url },
    }
  }
  return {
    ...command,
    title: command.title.trim(),
    description: command.description.trim(),
    category: command.category.trim(),
    aliases: command.aliases.map((value) => value.trim()).filter(Boolean),
    keywords: command.keywords.map((value) => value.trim()).filter(Boolean),
  }
}

function normalizedFields(command: SearchCommand): NormalizedSearchFields {
  return {
    title: normalizeSearchQuery(command.title),
    aliases: command.aliases.map(normalizeSearchQuery),
    description: normalizeSearchQuery(command.description),
    category: normalizeSearchQuery(command.category),
    keywords: command.keywords.map(normalizeSearchQuery),
    url: normalizeSearchQuery(command.searchableUrl ?? ''),
  }
}

export function createCommandIndex(input: readonly SearchCommand[]): CommandIndex {
  const ordered = input
    .map(normalizeCommand)
    .filter((command): command is SearchCommand => command !== undefined)
    .sort(
      (left, right) =>
        kindRank(left.kind) - kindRank(right.kind) ||
        left.sourceOrder - right.sourceOrder ||
        asciiCompare(left.key, right.key),
    )
  const commands: SearchCommand[] = []
  const normalizedByKey = new Map<CommandKey, NormalizedSearchFields>()
  const seen = new Set<CommandKey>()
  ordered.forEach((command) => {
    if (seen.has(command.key)) return
    seen.add(command.key)
    commands.push(command)
    normalizedByKey.set(command.key, normalizedFields(command))
  })
  return { commands, normalizedByKey }
}

function siteKey(id: UUID): CommandKey {
  return `site:${id}`
}

function toolKey(id: ToolId): CommandKey {
  return `tool:${id}`
}

export function buildCommandIndex(input: {
  tools: readonly ToolDefinition[]
  categories: readonly NavCategoryV2[]
}): CommandIndex {
  const commands: SearchCommand[] = input.tools.map((tool) => ({
    key: toolKey(tool.id),
    ref: { kind: 'tool', id: tool.id },
    kind: 'tool',
    title: tool.title,
    aliases: tool.aliases,
    description: tool.description,
    category: tool.category,
    keywords: tool.keywords,
    sourceOrder: tool.order,
    action: { type: 'open-tool', path: tool.path },
  }))

  let siteOrder = 0
  const orderedCategories = [...input.categories].sort(
    (left, right) => left.order - right.order || asciiCompare(left.id, right.id),
  )
  orderedCategories.forEach((category) => {
    const orderedLinks = [...category.links].sort(
      (left, right) => left.order - right.order || asciiCompare(left.id, right.id),
    )
    orderedLinks.forEach((link) => {
      const url = link.url.trim()
      if (!isSafeNavigationUrl(url) || link.name.trim().length === 0) return
      const safeUrl = url as SafeHttpUrl
      commands.push({
        key: siteKey(link.id),
        ref: { kind: 'site', id: link.id },
        kind: 'site',
        title: link.name,
        aliases: [],
        description: link.description,
        category: category.name,
        keywords: [],
        searchableUrl: safeUrl,
        sourceOrder: siteOrder,
        action: { type: 'open-site', url: safeUrl },
      })
      siteOrder += 1
    })
  })

  return createCommandIndex(commands)
}

export function buildRankingContext(input: BuildRankingContextInput): RankingContext {
  const favoriteKeys = new Set<CommandKey>()
  input.favorites?.forEach((favorite) => favoriteKeys.add(commandKeyForRef(favorite.ref)))

  const latestOpenedAt = new Map<CommandKey, number>()
  input.recents?.forEach((recent) => {
    const openedAt = Date.parse(recent.openedAt)
    if (!Number.isFinite(openedAt)) return
    const key = commandKeyForRef(recent.ref)
    const previous = latestOpenedAt.get(key)
    if (previous === undefined || openedAt > previous) latestOpenedAt.set(key, openedAt)
  })

  return {
    favoriteKeys,
    latestOpenedAt,
    now: Number.isFinite(input.now) ? input.now : 0,
  }
}

function findMatch(fields: NormalizedSearchFields, query: string): SearchHit['match'] | undefined {
  if (fields.title === query) return { tier: 0, field: 'title' }
  if (fields.title.startsWith(query)) return { tier: 1, field: 'title' }
  if (fields.aliases.some((value) => value.startsWith(query))) return { tier: 2, field: 'alias' }
  if (fields.title.includes(query)) return { tier: 3, field: 'title' }
  if (fields.aliases.some((value) => value.includes(query))) return { tier: 4, field: 'alias' }
  if (fields.keywords.some((value) => value.includes(query))) return { tier: 4, field: 'keyword' }
  if (fields.category.includes(query)) return { tier: 5, field: 'category' }
  if (fields.url.includes(query)) return { tier: 5, field: 'url' }
  if (fields.description.includes(query)) return { tier: 6, field: 'description' }
  return undefined
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function recentBucket(openedAt: number | undefined, now: number): number {
  if (openedAt === undefined) return 5
  const age = Math.max(0, now - openedAt)
  if (age < HOUR) return 0
  if (age < DAY) return 1
  if (age < 7 * DAY) return 2
  if (age < 30 * DAY) return 3
  return 4
}

interface RankedHit extends SearchHit {
  favoriteRank: number
  recentRank: number
}

export function searchCommands(
  index: CommandIndex,
  query: string,
  context: RankingContext,
): readonly SearchHit[] {
  const normalizedQuery = normalizeSearchQuery(query)
  if (normalizedQuery.length === 0) return []

  const hits: RankedHit[] = []
  index.commands.forEach((command) => {
    const fields = index.normalizedByKey.get(command.key)
    if (!fields) return
    const match = findMatch(fields, normalizedQuery)
    if (!match) return
    hits.push({
      command,
      match,
      favoriteRank: context.favoriteKeys.has(command.key) ? 0 : 1,
      recentRank: recentBucket(context.latestOpenedAt.get(command.key), context.now),
    })
  })

  hits.sort(
    (left, right) =>
      left.match.tier - right.match.tier ||
      left.favoriteRank - right.favoriteRank ||
      left.recentRank - right.recentRank ||
      kindRank(left.command.kind) - kindRank(right.command.kind) ||
      left.command.sourceOrder - right.command.sourceOrder ||
      asciiCompare(left.command.key, right.command.key),
  )

  return hits.map(({ command, match }) => ({ command, match }))
}
