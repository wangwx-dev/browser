import type {
  FavoriteV2,
  ISODateTime,
  JsonValue,
  LegacyShadow,
  LegacySourceFingerprint,
  NavCategoryV2,
  NavConfigIssue,
  NavConfigV2,
  NavConfigWarning,
  NavLinkV2,
  ParseRemoteDocumentOptions,
  ParseRemoteDocumentResult,
  RecentV2,
  ResourceRefV2,
  SerializeNavConfigV1Result,
  SafeHttpUrl,
  SerializedNavCategoryV1,
  SerializedNavConfigV1,
  SerializedNavConfigV2,
  SerializedNavLinkV1,
  ToolId,
  UUID,
} from '../types/workspace'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const TOOL_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i
const UNSAFE_EXTENSION_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const INVALID_JSON = Symbol('invalid-json')

type UnsafeExtensionKey = NavConfigWarning['key']
type JsonCloneResult = JsonValue | typeof INVALID_JSON

interface ValidationContext {
  issues: NavConfigIssue[]
  warnings: NavConfigWarning[]
  entityIds: Set<string>
}

interface ParsedLegacyLink {
  name: string
  url: string
  description: string
  icon?: string
  extensions?: Record<string, JsonValue>
}

interface ParsedLegacyCategory {
  name: string
  links: ParsedLegacyLink[]
  extensions?: Record<string, JsonValue>
}

interface LegacyIdentityCategory {
  id: UUID
  linkIds: UUID[]
}

interface LegacyIdentity {
  configId: UUID
  adaptedAt: ISODateTime
  categories: LegacyIdentityCategory[]
}

function createContext(): ValidationContext {
  return { issues: [], warnings: [], entityIds: new Set<string>() }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function forEachDenseArray(
  values: unknown[],
  path: string,
  context: ValidationContext,
  visitor: (value: unknown, index: number) => void,
): void {
  for (const key of Object.keys(values)) {
    const numericKey = Number(key)
    if (!Number.isInteger(numericKey) || numericKey < 0 || numericKey >= values.length || String(numericKey) !== key) {
      addIssue(context, 'invalid-json', `${path}.${key}`, 'Arrays cannot contain named properties.')
    }
  }
  if (Object.getOwnPropertySymbols(values).length > 0) {
    addIssue(context, 'invalid-json', path, 'Arrays cannot contain symbol properties.')
  }
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(values, index)) {
      addIssue(context, 'invalid-json', `${path}[${index}]`, 'Sparse arrays are not valid JSON documents.')
      continue
    }
    visitor(values[index], index)
  }
}

function addIssue(
  context: ValidationContext,
  code: NavConfigIssue['code'],
  path: string,
  message: string,
): void {
  context.issues.push({ code, path, message })
}

function addUnsafeKeyWarning(
  context: ValidationContext,
  path: string,
  key: string,
): void {
  context.warnings.push({
    code: 'unsafe-extension-key',
    path,
    key: key as UnsafeExtensionKey,
    message: `Extension key "${key}" was ignored to prevent prototype pollution.`,
  })
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
  allowEmpty = true,
): string | undefined {
  if (!hasOwn(record, key)) {
    addIssue(context, 'missing-field', `${path}.${key}`, `Required field "${key}" is missing.`)
    return undefined
  }

  const value = record[key]
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    addIssue(
      context,
      'invalid-type',
      `${path}.${key}`,
      `Field "${key}" must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`,
    )
    return undefined
  }
  return value
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): string | undefined {
  if (!hasOwn(record, key)) return undefined
  if (typeof record[key] !== 'string') {
    addIssue(context, 'invalid-type', `${path}.${key}`, `Optional field "${key}" must be a string.`)
    return undefined
  }
  return record[key]
}

function readUUID(
  value: unknown,
  path: string,
  context: ValidationContext,
): UUID | undefined {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    addIssue(context, 'invalid-id', path, 'Expected a canonical RFC 4122 UUID.')
    return undefined
  }
  return value as UUID
}

function readEntityUUID(
  value: unknown,
  path: string,
  context: ValidationContext,
): UUID | undefined {
  const id = readUUID(value, path, context)
  if (!id) return undefined
  if (context.entityIds.has(id)) {
    addIssue(context, 'duplicate-id', path, `Entity UUID "${id}" is already in use.`)
    return undefined
  }
  context.entityIds.add(id)
  return id
}

function readISODateTime(
  value: unknown,
  path: string,
  context: ValidationContext,
): ISODateTime | undefined {
  if (typeof value !== 'string' || !ISO_DATE_TIME_PATTERN.test(value)) {
    addIssue(context, 'invalid-timestamp', path, 'Expected a canonical UTC ISO timestamp with milliseconds.')
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    addIssue(context, 'invalid-timestamp', path, 'Timestamp is not a real canonical UTC instant.')
    return undefined
  }
  return value as ISODateTime
}

function readRevision(value: unknown, path: string, context: ValidationContext): number | undefined {
  if (!Number.isInteger(value) || (value as number) < 1) {
    addIssue(context, 'invalid-revision', path, 'Revision must be an integer greater than or equal to 1.')
    return undefined
  }
  return value as number
}

function readOrder(
  value: unknown,
  expected: number,
  path: string,
  context: ValidationContext,
): number | undefined {
  if (!Number.isInteger(value) || value !== expected) {
    addIssue(context, 'invalid-order', path, `Order must be the continuous sibling index ${expected}.`)
    return undefined
  }
  return expected
}

function cloneJsonValue(
  value: unknown,
  path: string,
  context: ValidationContext,
  ancestors = new WeakSet<object>(),
): JsonCloneResult {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    addIssue(context, 'invalid-json', path, 'JSON numbers must be finite.')
    return INVALID_JSON
  }

  if (typeof value !== 'object') {
    addIssue(context, 'invalid-json', path, 'Extension values must be JSON-compatible.')
    return INVALID_JSON
  }
  if (ancestors.has(value)) {
    addIssue(context, 'invalid-json', path, 'Circular extension values are not JSON-compatible.')
    return INVALID_JSON
  }
  ancestors.add(value)

  if (Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      const numericKey = Number(key)
      if (!Number.isInteger(numericKey) || numericKey < 0 || numericKey >= value.length || String(numericKey) !== key) {
        addIssue(context, 'invalid-json', `${path}.${key}`, 'JSON arrays cannot contain named properties.')
        ancestors.delete(value)
        return INVALID_JSON
      }
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      addIssue(context, 'invalid-json', path, 'JSON arrays cannot contain symbol properties.')
      ancestors.delete(value)
      return INVALID_JSON
    }
    const result: JsonValue[] = []
    for (let index = 0; index < value.length; index += 1) {
      const cloned = cloneJsonValue(value[index], `${path}[${index}]`, context, ancestors)
      if (cloned === INVALID_JSON) {
        ancestors.delete(value)
        return INVALID_JSON
      }
      result.push(cloned)
    }
    ancestors.delete(value)
    return result
  }

  if (!isPlainRecord(value)) {
    addIssue(context, 'invalid-json', path, 'Extension objects must use a plain JSON object prototype.')
    ancestors.delete(value)
    return INVALID_JSON
  }

  const result: Record<string, JsonValue> = {}
  for (const key of Object.keys(value)) {
    if (UNSAFE_EXTENSION_KEYS.has(key)) {
      addUnsafeKeyWarning(context, `${path}.${key}`, key)
      continue
    }
    const cloned = cloneJsonValue(value[key], `${path}.${key}`, context, ancestors)
    if (cloned === INVALID_JSON) {
      ancestors.delete(value)
      return INVALID_JSON
    }
    result[key] = cloned
  }
  ancestors.delete(value)
  return result
}

function collectExtensions(
  record: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
  path: string,
  context: ValidationContext,
  explicitExtensions: boolean,
): Record<string, JsonValue> | undefined {
  const result: Record<string, JsonValue> = {}
  let shouldKeepEmptyObject = false

  for (const key of Object.keys(record)) {
    if (knownKeys.has(key)) continue
    if (UNSAFE_EXTENSION_KEYS.has(key)) {
      addUnsafeKeyWarning(context, `${path}.${key}`, key)
      continue
    }
    const cloned = cloneJsonValue(record[key], `${path}.${key}`, context)
    if (cloned !== INVALID_JSON) result[key] = cloned
  }

  if (explicitExtensions && hasOwn(record, 'extensions')) {
    shouldKeepEmptyObject = true
    const extensions = record.extensions
    if (!isPlainRecord(extensions)) {
      addIssue(context, 'invalid-json', `${path}.extensions`, 'Extensions must be a plain JSON object.')
    } else {
      for (const key of Object.keys(extensions)) {
        if (UNSAFE_EXTENSION_KEYS.has(key)) {
          addUnsafeKeyWarning(context, `${path}.extensions.${key}`, key)
          continue
        }
        if (hasOwn(result, key)) {
          addIssue(
            context,
            'invalid-json',
            `${path}.extensions.${key}`,
            `Extension key "${key}" is present both inline and inside extensions.`,
          )
          continue
        }
        const cloned = cloneJsonValue(extensions[key], `${path}.extensions.${key}`, context)
        if (cloned !== INVALID_JSON) result[key] = cloned
      }
    }
  }

  return Object.keys(result).length > 0 || shouldKeepEmptyObject ? result : undefined
}

function assertOnlyKnownFields(
  record: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
  path: string,
  context: ValidationContext,
): void {
  for (const key of Object.keys(record)) {
    if (knownKeys.has(key)) continue
    if (UNSAFE_EXTENSION_KEYS.has(key)) {
      addUnsafeKeyWarning(context, `${path}.${key}`, key)
      continue
    }
    addIssue(context, 'unknown-field', `${path}.${key}`, `Unknown field "${key}" cannot be preserved here.`)
  }
}

function parseResourceRef(
  value: unknown,
  path: string,
  context: ValidationContext,
): ResourceRefV2 | undefined {
  if (!isPlainRecord(value)) {
    addIssue(context, 'invalid-type', path, 'Resource reference must be an object.')
    return undefined
  }
  assertOnlyKnownFields(value, new Set(['kind', 'id']), path, context)
  const kind = readRequiredString(value, 'kind', path, context, false)
  if (kind === 'site') {
    const id = readUUID(value.id, `${path}.id`, context)
    return id ? { kind, id } : undefined
  }
  if (kind === 'tool') {
    const rawId = readRequiredString(value, 'id', path, context, false)
    if (!rawId) return undefined
    if (!TOOL_ID_PATTERN.test(rawId)) {
      addIssue(context, 'invalid-id', `${path}.id`, 'Tool ID must be a stable dotted, dashed or underscored token.')
      return undefined
    }
    return { kind, id: rawId as ToolId }
  }
  if (kind !== undefined) {
    addIssue(context, 'invalid-type', `${path}.kind`, 'Resource kind must be "site" or "tool".')
  }
  return undefined
}

function parseFavorite(value: unknown, index: number, context: ValidationContext): FavoriteV2 | undefined {
  const path = `$.favorites[${index}]`
  if (!isPlainRecord(value)) {
    addIssue(context, 'invalid-type', path, 'Favorite must be an object.')
    return undefined
  }
  assertOnlyKnownFields(value, new Set(['ref', 'createdAt']), path, context)
  const ref = parseResourceRef(value.ref, `${path}.ref`, context)
  const createdAt = readISODateTime(value.createdAt, `${path}.createdAt`, context)
  return ref && createdAt ? { ref, createdAt } : undefined
}

function parseRecent(value: unknown, index: number, context: ValidationContext): RecentV2 | undefined {
  const path = `$.recents[${index}]`
  if (!isPlainRecord(value)) {
    addIssue(context, 'invalid-type', path, 'Recent item must be an object.')
    return undefined
  }
  assertOnlyKnownFields(value, new Set(['ref', 'openedAt']), path, context)
  const ref = parseResourceRef(value.ref, `${path}.ref`, context)
  const openedAt = readISODateTime(value.openedAt, `${path}.openedAt`, context)
  return ref && openedAt ? { ref, openedAt } : undefined
}

function parseLink(
  value: unknown,
  categoryIndex: number,
  linkIndex: number,
  context: ValidationContext,
): NavLinkV2 | undefined {
  const path = `$.categories[${categoryIndex}].links[${linkIndex}]`
  if (!isPlainRecord(value)) {
    addIssue(context, 'invalid-type', path, 'Navigation link must be an object.')
    return undefined
  }
  const knownKeys = new Set([
    'id',
    'name',
    'url',
    'description',
    'icon',
    'order',
    'createdAt',
    'updatedAt',
    'extensions',
  ])
  const id = readEntityUUID(value.id, `${path}.id`, context)
  const name = readRequiredString(value, 'name', path, context, false)
  const url = readRequiredString(value, 'url', path, context, false)
  const description = readRequiredString(value, 'description', path, context)
  const icon = readOptionalString(value, 'icon', path, context)
  const order = readOrder(value.order, linkIndex, `${path}.order`, context)
  const createdAt = readISODateTime(value.createdAt, `${path}.createdAt`, context)
  const updatedAt = readISODateTime(value.updatedAt, `${path}.updatedAt`, context)
  const extensions = collectExtensions(value, knownKeys, path, context, true)

  if (!id || name === undefined || url === undefined || description === undefined || order === undefined || !createdAt || !updatedAt) {
    return undefined
  }
  return {
    id,
    name,
    url,
    description,
    ...(icon === undefined ? {} : { icon }),
    order,
    createdAt,
    updatedAt,
    ...(extensions === undefined ? {} : { extensions }),
  }
}

function parseCategory(
  value: unknown,
  categoryIndex: number,
  context: ValidationContext,
): NavCategoryV2 | undefined {
  const path = `$.categories[${categoryIndex}]`
  if (!isPlainRecord(value)) {
    addIssue(context, 'invalid-type', path, 'Navigation category must be an object.')
    return undefined
  }
  const knownKeys = new Set(['id', 'name', 'order', 'links', 'createdAt', 'updatedAt', 'extensions'])
  const id = readEntityUUID(value.id, `${path}.id`, context)
  const name = readRequiredString(value, 'name', path, context, false)
  const order = readOrder(value.order, categoryIndex, `${path}.order`, context)
  const createdAt = readISODateTime(value.createdAt, `${path}.createdAt`, context)
  const updatedAt = readISODateTime(value.updatedAt, `${path}.updatedAt`, context)
  const extensions = collectExtensions(value, knownKeys, path, context, true)

  const links: NavLinkV2[] = []
  if (!Array.isArray(value.links)) {
    addIssue(context, 'invalid-type', `${path}.links`, 'Category links must be an array.')
  } else {
    forEachDenseArray(value.links, `${path}.links`, context, (link, linkIndex) => {
      const parsed = parseLink(link, categoryIndex, linkIndex, context)
      if (parsed) links.push(parsed)
    })
  }

  if (!id || name === undefined || order === undefined || !createdAt || !updatedAt || !Array.isArray(value.links)) {
    return undefined
  }
  return {
    id,
    name,
    order,
    links,
    createdAt,
    updatedAt,
    ...(extensions === undefined ? {} : { extensions }),
  }
}

function parseV2Document(raw: Record<string, unknown>, context: ValidationContext): NavConfigV2 | undefined {
  const knownKeys = new Set([
    'schemaVersion',
    'configId',
    'revision',
    'updatedAt',
    'categories',
    'favorites',
    'recents',
    'extensions',
  ])
  if (raw.schemaVersion !== 2) {
    addIssue(context, 'invalid-type', '$.schemaVersion', 'schemaVersion must be exactly 2.')
  }
  const configId = readEntityUUID(raw.configId, '$.configId', context)
  const revision = readRevision(raw.revision, '$.revision', context)
  const updatedAt = readISODateTime(raw.updatedAt, '$.updatedAt', context)
  const extensions = collectExtensions(raw, knownKeys, '$', context, true)

  const categories: NavCategoryV2[] = []
  if (!Array.isArray(raw.categories)) {
    addIssue(context, 'invalid-type', '$.categories', 'Categories must be an array.')
  } else {
    forEachDenseArray(raw.categories, '$.categories', context, (category, categoryIndex) => {
      const parsed = parseCategory(category, categoryIndex, context)
      if (parsed) categories.push(parsed)
    })
  }

  const favorites: FavoriteV2[] = []
  if (!Array.isArray(raw.favorites)) {
    addIssue(context, 'invalid-type', '$.favorites', 'Favorites must be an array.')
  } else {
    forEachDenseArray(raw.favorites, '$.favorites', context, (favorite, index) => {
      const parsed = parseFavorite(favorite, index, context)
      if (parsed) favorites.push(parsed)
    })
  }

  const recents: RecentV2[] = []
  if (!Array.isArray(raw.recents)) {
    addIssue(context, 'invalid-type', '$.recents', 'Recents must be an array.')
  } else {
    forEachDenseArray(raw.recents, '$.recents', context, (recent, index) => {
      const parsed = parseRecent(recent, index, context)
      if (parsed) recents.push(parsed)
    })
  }

  if (
    context.issues.length > 0 ||
    !configId ||
    revision === undefined ||
    !updatedAt ||
    !Array.isArray(raw.categories) ||
    !Array.isArray(raw.favorites) ||
    !Array.isArray(raw.recents)
  ) {
    return undefined
  }

  return {
    schemaVersion: 2,
    configId,
    revision,
    updatedAt,
    categories,
    favorites,
    recents,
    ...(extensions === undefined ? {} : { extensions }),
  }
}

function parseLegacyLink(
  value: unknown,
  categoryIndex: number,
  linkIndex: number,
  context: ValidationContext,
): ParsedLegacyLink | undefined {
  const path = `$[${categoryIndex}].links[${linkIndex}]`
  if (!isPlainRecord(value)) {
    addIssue(context, 'invalid-type', path, 'Legacy link must be an object.')
    return undefined
  }
  const knownKeys = new Set(['name', 'url', 'desc', 'icon'])
  const name = readRequiredString(value, 'name', path, context, false)
  const url = readRequiredString(value, 'url', path, context, false)
  const description = hasOwn(value, 'desc')
    ? readRequiredString(value, 'desc', path, context)
    : ''
  const icon = readOptionalString(value, 'icon', path, context)
  const extensions = collectExtensions(value, knownKeys, path, context, false)
  if (name === undefined || url === undefined || description === undefined) return undefined
  return {
    name,
    url,
    description,
    ...(icon === undefined ? {} : { icon }),
    ...(extensions === undefined ? {} : { extensions }),
  }
}

function parseLegacyCategories(raw: unknown[], context: ValidationContext): ParsedLegacyCategory[] | undefined {
  const categories: ParsedLegacyCategory[] = []
  forEachDenseArray(raw, '$', context, (value, categoryIndex) => {
    const path = `$[${categoryIndex}]`
    if (!isPlainRecord(value)) {
      addIssue(context, 'invalid-type', path, 'Legacy category must be an object.')
      return
    }
    const knownKeys = new Set(['category', 'links'])
    const name = readRequiredString(value, 'category', path, context, false)
    const extensions = collectExtensions(value, knownKeys, path, context, false)
    const links: ParsedLegacyLink[] = []
    if (!Array.isArray(value.links)) {
      addIssue(context, 'invalid-type', `${path}.links`, 'Legacy category links must be an array.')
    } else {
      forEachDenseArray(value.links, `${path}.links`, context, (link, linkIndex) => {
        const parsed = parseLegacyLink(link, categoryIndex, linkIndex, context)
        if (parsed) links.push(parsed)
      })
    }
    if (name !== undefined && Array.isArray(value.links)) {
      categories.push({
        name,
        links,
        ...(extensions === undefined ? {} : { extensions }),
      })
    }
  })
  return context.issues.length === 0 ? categories : undefined
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  throw new TypeError('Fingerprint input must already be JSON-compatible.')
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift))
}

function sha256(value: string): string {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ]
  const state = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]
  const source = new TextEncoder().encode(value)
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(source)
  padded[source.length] = 0x80
  const bitLength = source.length * 8
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)
  const words = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false)
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]
      const right = words[index - 2]
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3)
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10)
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choose = (e & f) ^ (~e & g)
      const temporary1 = (h + sum1 + choose + constants[index] + words[index]) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }
    state[0] = (state[0] + a) >>> 0
    state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0
    state[3] = (state[3] + d) >>> 0
    state[4] = (state[4] + e) >>> 0
    state[5] = (state[5] + f) >>> 0
    state[6] = (state[6] + g) >>> 0
    state[7] = (state[7] + h) >>> 0
  }
  return state.map((part) => part.toString(16).padStart(8, '0')).join('')
}

function fingerprintLegacySource(categories: ParsedLegacyCategory[]): LegacySourceFingerprint {
  return `legacy-v1:sha256:${sha256(canonicalJson(categories))}` as LegacySourceFingerprint
}

function defaultNewId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is unavailable in this runtime.')
  }
  return globalThis.crypto.randomUUID()
}

function defaultNow(): string {
  return new Date().toISOString()
}

function invokeGenerator(
  generator: () => string,
  path: string,
  label: string,
  context: ValidationContext,
): string | undefined {
  try {
    return generator()
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown generator error'
    addIssue(context, 'generator-failed', path, `${label} generator failed: ${detail}`)
    return undefined
  }
}

function createFreshIdentity(
  categories: ParsedLegacyCategory[],
  options: ParseRemoteDocumentOptions,
  context: ValidationContext,
): LegacyIdentity | undefined {
  const nowOption = options.now
  const timeGenerator =
    typeof nowOption === 'function'
      ? nowOption
      : nowOption === undefined
        ? defaultNow
        : () => nowOption
  const rawTime = invokeGenerator(timeGenerator, '$.updatedAt', 'Time', context)
  const adaptedAt = rawTime === undefined ? undefined : readISODateTime(rawTime, '$.updatedAt', context)
  const idGenerator = options.newId ?? defaultNewId
  const rawConfigId = invokeGenerator(idGenerator, '$.configId', 'ID', context)
  const configId = rawConfigId === undefined ? undefined : readEntityUUID(rawConfigId, '$.configId', context)
  const categoryIdentities: LegacyIdentityCategory[] = []

  categories.forEach((category, categoryIndex) => {
    const path = `$.categories[${categoryIndex}]`
    const rawCategoryId = invokeGenerator(idGenerator, `${path}.id`, 'ID', context)
    const id = rawCategoryId === undefined ? undefined : readEntityUUID(rawCategoryId, `${path}.id`, context)
    const linkIds: UUID[] = []
    category.links.forEach((_link, linkIndex) => {
      const linkPath = `${path}.links[${linkIndex}].id`
      const rawLinkId = invokeGenerator(idGenerator, linkPath, 'ID', context)
      const linkId = rawLinkId === undefined ? undefined : readEntityUUID(rawLinkId, linkPath, context)
      if (linkId) linkIds.push(linkId)
    })
    if (id) categoryIdentities.push({ id, linkIds })
  })

  if (!adaptedAt || !configId || context.issues.length > 0) return undefined
  return { configId, adaptedAt, categories: categoryIdentities }
}

function cloneLegacyShadow(
  input: LegacyShadow,
  context: ValidationContext,
): LegacyShadow | undefined {
  const raw: unknown = input
  if (!isPlainRecord(raw)) {
    addIssue(context, 'invalid-shadow', '$.shadow', 'Legacy shadow must be an object.')
    return undefined
  }
  assertOnlyKnownFields(raw, new Set(['sourceFingerprint', 'document']), '$.shadow', context)
  if (typeof raw.sourceFingerprint !== 'string' || raw.sourceFingerprint.length === 0) {
    addIssue(context, 'invalid-shadow', '$.shadow.sourceFingerprint', 'Legacy shadow fingerprint must be a string.')
  }
  if (!isPlainRecord(raw.document) || raw.document.schemaVersion !== 2) {
    addIssue(context, 'invalid-shadow', '$.shadow.document', 'Legacy shadow document must be NavConfigV2.')
    return undefined
  }
  const documentContext = createContext()
  const document = parseV2Document(raw.document, documentContext)
  context.issues.push(
    ...documentContext.issues.map((issue) => ({
      ...issue,
      path: `$.shadow.document${issue.path.slice(1)}`,
    })),
  )
  context.warnings.push(
    ...documentContext.warnings.map((warning) => ({
      ...warning,
      path: `$.shadow.document${warning.path.slice(1)}`,
    })),
  )
  if (!document || typeof raw.sourceFingerprint !== 'string' || context.issues.length > 0) return undefined
  return {
    sourceFingerprint: raw.sourceFingerprint as LegacySourceFingerprint,
    document,
  }
}

function buildAdaptedDocument(categories: ParsedLegacyCategory[], identity: LegacyIdentity): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: identity.configId,
    revision: 1,
    updatedAt: identity.adaptedAt,
    categories: categories.map((category, categoryIndex) => ({
      id: identity.categories[categoryIndex].id,
      name: category.name,
      order: categoryIndex,
      links: category.links.map((link, linkIndex) => ({
        id: identity.categories[categoryIndex].linkIds[linkIndex],
        name: link.name,
        url: link.url,
        description: link.description,
        ...(link.icon === undefined ? {} : { icon: link.icon }),
        order: linkIndex,
        createdAt: identity.adaptedAt,
        updatedAt: identity.adaptedAt,
        ...(link.extensions === undefined ? {} : { extensions: link.extensions }),
      })),
      createdAt: identity.adaptedAt,
      updatedAt: identity.adaptedAt,
      ...(category.extensions === undefined ? {} : { extensions: category.extensions }),
    })),
    favorites: [],
    recents: [],
  }
}

function invalidResult(context: ValidationContext): ParseRemoteDocumentResult {
  return { kind: 'invalid', issues: context.issues, warnings: context.warnings }
}

function cloneValidatedV2(document: NavConfigV2): NavConfigV2 {
  const raw: unknown = document
  if (!isPlainRecord(raw)) throw new TypeError('NavConfigV2 must be a plain object.')
  const context = createContext()
  const cloned = parseV2Document(raw, context)
  if (!cloned || context.warnings.length > 0) {
    throw new TypeError('Could not clone an internally generated NavConfigV2 document.')
  }
  return cloned
}

export function parseRemoteDocument(
  raw: unknown,
  options: ParseRemoteDocumentOptions = {},
): ParseRemoteDocumentResult {
  if (!Array.isArray(raw)) {
    const context = createContext()
    if (!isPlainRecord(raw)) {
      addIssue(context, 'invalid-type', '$', 'Remote navigation data must be a v1 array or v2 object.')
      return invalidResult(context)
    }
    if (raw.schemaVersion !== 2) {
      addIssue(context, 'invalid-type', '$.schemaVersion', 'Object documents must declare schemaVersion 2.')
      return invalidResult(context)
    }
    const document = parseV2Document(raw, context)
    if (!document) return invalidResult(context)
    return { kind: 'valid-v2', document, warnings: context.warnings }
  }

  const context = createContext()
  const categories = parseLegacyCategories(raw, context)
  if (!categories) return invalidResult(context)
  const sourceFingerprint = fingerprintLegacySource(categories)

  let shadow: LegacyShadow | undefined
  let document: NavConfigV2 | undefined
  let reused = false
  if (options.shadow !== undefined) {
    const previous = cloneLegacyShadow(options.shadow, context)
    if (!previous) return invalidResult(context)
    if (previous.sourceFingerprint !== sourceFingerprint) {
      return {
        kind: 'legacy-changed',
        sourceFingerprint,
        previousFingerprint: previous.sourceFingerprint,
        previous,
        warnings: context.warnings,
      }
    }
    shadow = previous
    document = cloneValidatedV2(previous.document)
    reused = true
  } else {
    const identity = createFreshIdentity(categories, options, context)
    if (identity) {
      document = buildAdaptedDocument(categories, identity)
      shadow = { sourceFingerprint, document: cloneValidatedV2(document) }
    }
  }

  if (!shadow || !document) return invalidResult(context)
  return {
    kind: 'adapted-v1',
    document,
    shadow,
    sourceFingerprint,
    reused,
    reusedShadow: reused,
    warnings: context.warnings,
  }
}

export function serializeNavConfigV2(document: NavConfigV2): SerializedNavConfigV2 {
  const parsed = parseRemoteDocument(document)
  if (parsed.kind !== 'valid-v2') {
    const details = parsed.kind === 'invalid' ? parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ') : parsed.kind
    throw new TypeError(`Cannot serialize an invalid NavConfigV2 document: ${details}`)
  }
  if (parsed.warnings.length > 0) {
    throw new TypeError('Cannot serialize a NavConfigV2 document containing unsafe extension keys.')
  }
  return parsed.document as SerializedNavConfigV2
}

export function normalizeNavConfig(document: NavConfigV2): NavConfigV2 {
  const candidate: NavConfigV2 = {
    ...document,
    categories: document.categories.map((category, categoryIndex) => ({
      ...category,
      order: categoryIndex,
      links: category.links.map((link, linkIndex) => ({ ...link, order: linkIndex })),
    })),
  }
  return serializeNavConfigV2(candidate)
}

function copyLegacyExtensions(
  target: Record<string, unknown>,
  extensions: Record<string, JsonValue> | undefined,
  reserved: ReadonlySet<string>,
): void {
  if (!extensions) return
  for (const [key, value] of Object.entries(extensions)) {
    if (reserved.has(key) || UNSAFE_EXTENSION_KEYS.has(key)) continue
    target[key] = value
  }
}

export function serializeNavConfigV1(document: NavConfigV2): SerializeNavConfigV1Result {
  const normalized = serializeNavConfigV2(document)
  const serialized: SerializedNavCategoryV1[] = normalized.categories.map((category) => {
    const output: Record<string, unknown> = {}
    copyLegacyExtensions(output, category.extensions, new Set(['category', 'links']))
    output.category = category.name
    output.links = category.links.map((link) => {
      const linkOutput: Record<string, unknown> = {}
      copyLegacyExtensions(linkOutput, link.extensions, new Set(['name', 'url', 'desc', 'icon']))
      linkOutput.name = link.name
      linkOutput.url = link.url
      linkOutput.desc = link.description
      if (link.icon !== undefined) linkOutput.icon = link.icon
      return linkOutput as unknown as SerializedNavLinkV1
    })
    return output as unknown as SerializedNavCategoryV1
  })

  const stableIdCount =
    1 + normalized.categories.length + normalized.categories.reduce((total, category) => total + category.links.length, 0)
  const rootExtensionCount = Object.keys(normalized.extensions ?? {}).length
  const losses: SerializeNavConfigV1Result['losses'] = [
    { kind: 'stable-ids', count: stableIdCount },
    { kind: 'favorites', count: normalized.favorites.length },
    { kind: 'recents', count: normalized.recents.length },
  ]
  if (rootExtensionCount > 0) losses.push({ kind: 'root-extensions', count: rootExtensionCount })
  return {
    raw: serialized as SerializedNavConfigV1,
    lostCapabilities: ['stable-ids', 'favorites', 'recents'],
    losses,
  }
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

export function isSafeNavigationUrl(value: unknown): value is SafeHttpUrl {
  if (typeof value !== 'string') return false
  const normalized = value.trim()
  if (!/^https?:\/\//i.test(normalized) || containsControlCharacter(normalized)) return false
  try {
    const parsed = new URL(normalized)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0
  } catch {
    return false
  }
}
