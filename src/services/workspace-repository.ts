import type { SupabaseClient } from '@supabase/supabase-js'

import {
  parseRemoteDocument,
  serializeNavConfigV2,
} from '../domain/nav-config'
import type {
  LegacyShadow,
  NavConfigIssue,
  NavConfigV2,
  NavConfigWarning,
  UUID,
} from '../types/workspace'

const TABLE_NAME = 'user_nav_configs'
const SELECT_COLUMNS = 'nav_data,updated_at'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface WorkspaceGatewayRow {
  navData: unknown
  updatedAt: string | null
}

export type WorkspaceGatewayResult =
  | { kind: 'row'; row: WorkspaceGatewayRow }
  | { kind: 'not-found' }
  | { kind: 'error'; error: unknown }

export interface WorkspaceGatewayWriteInput {
  userId: string
  navData: unknown
  updatedAt: string
}

export interface WorkspaceGatewayUpdateInput extends WorkspaceGatewayWriteInput {
  expectedRemoteVersion: string
}

export interface WorkspaceGateway {
  load: (userId: string) => Promise<WorkspaceGatewayResult>
  insert: (input: WorkspaceGatewayWriteInput) => Promise<WorkspaceGatewayResult>
  updateIfVersion: (input: WorkspaceGatewayUpdateInput) => Promise<WorkspaceGatewayResult>
}

export interface RemoteWorkspaceSnapshot {
  document: NavConfigV2
  remoteVersion: string
}

export interface WorkspaceRepositoryError {
  code: 'AUTH_EXPIRED' | 'DATA_INVALID' | 'FORBIDDEN' | 'NETWORK' | 'UNKNOWN'
  message: string
  retryable: boolean
}

interface UnauthorizedResult {
  kind: 'unauthorized'
}

interface ForbiddenResult {
  kind: 'forbidden'
  error: WorkspaceRepositoryError
}

interface RetryableResult {
  kind: 'retryable'
  error: WorkspaceRepositoryError
}

interface FailedResult {
  kind: 'failed'
  error: WorkspaceRepositoryError
}

type RepositoryFailure = UnauthorizedResult | ForbiddenResult | RetryableResult | FailedResult

export type RemoteLoadResult =
  | {
      kind: 'loaded'
      source: 'v1' | 'v2'
      snapshot: RemoteWorkspaceSnapshot
      legacyShadow?: LegacyShadow
      warnings: readonly NavConfigWarning[]
    }
  | { kind: 'not-found' }
  | {
      kind: 'legacy-changed'
      remoteVersion: string
      previous: LegacyShadow
      warnings: readonly NavConfigWarning[]
    }
  | { kind: 'invalid'; issues: readonly NavConfigIssue[] }
  | RepositoryFailure

export interface RemoteLoadInput {
  userId: string
  legacyShadow?: LegacyShadow
}

export interface RemoteSaveInput {
  userId: string
  document: NavConfigV2
  expectedRemoteVersion: string | null
  mutationId: UUID
}

export type RemoteSaveResult =
  | { kind: 'saved'; snapshot: RemoteWorkspaceSnapshot }
  | { kind: 'conflict'; remote: RemoteWorkspaceSnapshot | null }
  | { kind: 'writer-disabled' }
  | { kind: 'invalid'; issues: readonly NavConfigIssue[] }
  | RepositoryFailure

export interface WorkspaceRepository {
  load: (input: RemoteLoadInput) => Promise<RemoteLoadResult>
  save: (input: RemoteSaveInput) => Promise<RemoteSaveResult>
}

export interface CreateWorkspaceRepositoryOptions {
  gateway: WorkspaceGateway
  writerEnabled: boolean
  now?: () => string
  newId?: () => string
}

function gatewayRow(data: unknown): WorkspaceGatewayResult {
  if (data === null || data === undefined) return { kind: 'not-found' }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { kind: 'error', error: { code: 'INVALID_RESPONSE' } }
  }
  const row = data as Record<string, unknown>
  return {
    kind: 'row',
    row: {
      navData: row.nav_data,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    },
  }
}

export function createSupabaseWorkspaceGateway(client: SupabaseClient): WorkspaceGateway {
  return {
    async load(userId) {
      try {
        const { data, error } = await client
          .from(TABLE_NAME)
          .select(SELECT_COLUMNS)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return { kind: 'error', error }
        return gatewayRow(data)
      } catch (error) {
        return { kind: 'error', error }
      }
    },

    async insert(input) {
      try {
        const { data, error } = await client
          .from(TABLE_NAME)
          .insert({
            user_id: input.userId,
            nav_data: input.navData,
            updated_at: input.updatedAt,
          })
          .select(SELECT_COLUMNS)
          .single()
        if (error) return { kind: 'error', error }
        return gatewayRow(data)
      } catch (error) {
        return { kind: 'error', error }
      }
    },

    async updateIfVersion(input) {
      try {
        const { data, error } = await client
          .from(TABLE_NAME)
          .update({ nav_data: input.navData, updated_at: input.updatedAt })
          .eq('user_id', input.userId)
          .eq('updated_at', input.expectedRemoteVersion)
          .select(SELECT_COLUMNS)
          .maybeSingle()
        if (error) return { kind: 'error', error }
        return gatewayRow(data)
      } catch (error) {
        return { kind: 'error', error }
      }
    },
  }
}

function invalidInput(path: string, message: string): { kind: 'invalid'; issues: NavConfigIssue[] } {
  return {
    kind: 'invalid',
    issues: [{ code: 'invalid-type', path, message }],
  }
}

function errorMetadata(error: unknown): { code: string; status?: number; message: string } {
  if (error instanceof TypeError) return { code: 'NETWORK', message: error.message }
  if (error === null || typeof error !== 'object') return { code: 'UNKNOWN', message: '' }
  const value = error as { code?: unknown; status?: unknown; message?: unknown }
  return {
    code: typeof value.code === 'string' ? value.code : 'UNKNOWN',
    ...(typeof value.status === 'number' ? { status: value.status } : {}),
    message: typeof value.message === 'string' ? value.message : '',
  }
}

function isUniqueConflict(error: unknown): boolean {
  const metadata = errorMetadata(error)
  return metadata.code === '23505' || metadata.status === 409
}

function classifyError(error: unknown): RepositoryFailure {
  const metadata = errorMetadata(error)
  if (metadata.status === 401 || metadata.code === 'PGRST301' || metadata.code === 'JWT_EXPIRED') {
    return { kind: 'unauthorized' }
  }
  if (metadata.status === 403 || metadata.code === '42501') {
    return {
      kind: 'forbidden',
      error: { code: 'FORBIDDEN', message: '当前账号无权访问个人工作区。', retryable: false },
    }
  }
  if (
    metadata.code === 'NETWORK' ||
    metadata.status === 0 ||
    (metadata.status !== undefined && metadata.status >= 500) ||
    /failed to fetch|network|timeout/i.test(metadata.message)
  ) {
    return {
      kind: 'retryable',
      error: { code: 'NETWORK', message: '暂时无法连接个人数据服务。', retryable: true },
    }
  }
  return {
    kind: 'failed',
    error: { code: 'UNKNOWN', message: '个人数据请求失败，现有本地内容保持不变。', retryable: false },
  }
}

function parseRow(
  row: WorkspaceGatewayRow,
  options: { legacyShadow?: LegacyShadow; now?: () => string; newId?: () => string },
): RemoteLoadResult {
  if (!row.updatedAt || row.updatedAt.trim().length === 0) {
    return invalidInput('$.updated_at', 'Remote workspace version is missing.')
  }
  const parsed = parseRemoteDocument(row.navData, {
    ...(options.legacyShadow ? { shadow: options.legacyShadow } : {}),
    ...(options.now ? { now: options.now } : {}),
    ...(options.newId ? { newId: options.newId } : {}),
  })
  if (parsed.kind === 'invalid') return { kind: 'invalid', issues: parsed.issues }
  if (parsed.kind === 'legacy-changed') {
    return {
      kind: 'legacy-changed',
      remoteVersion: row.updatedAt,
      previous: parsed.previous,
      warnings: parsed.warnings,
    }
  }
  return {
    kind: 'loaded',
    source: parsed.kind === 'adapted-v1' ? 'v1' : 'v2',
    snapshot: { document: parsed.document, remoteVersion: row.updatedAt },
    ...(parsed.kind === 'adapted-v1' ? { legacyShadow: parsed.shadow } : {}),
    warnings: parsed.warnings,
  }
}

async function safeGatewayCall(
  operation: () => Promise<WorkspaceGatewayResult>,
): Promise<WorkspaceGatewayResult> {
  try {
    return await operation()
  } catch (error) {
    return { kind: 'error', error }
  }
}

export function createWorkspaceRepository({
  gateway,
  writerEnabled,
  now = () => new Date().toISOString(),
  newId,
}: CreateWorkspaceRepositoryOptions): WorkspaceRepository {
  let saveTail: Promise<void> = Promise.resolve()
  const mutationFlights = new Map<string, Promise<RemoteSaveResult>>()

  const load = async (input: RemoteLoadInput): Promise<RemoteLoadResult> => {
    if (!UUID_PATTERN.test(input.userId)) return invalidInput('$.userId', 'User ID must be a UUID.')
    const result = await safeGatewayCall(() => gateway.load(input.userId))
    if (result.kind === 'not-found') return result
    if (result.kind === 'error') return classifyError(result.error)
    return parseRow(result.row, { legacyShadow: input.legacyShadow, now, newId })
  }

  const conflictAfterMiss = async (userId: string): Promise<RemoteSaveResult> => {
    const remote = await load({ userId })
    if (remote.kind === 'loaded') return { kind: 'conflict', remote: remote.snapshot }
    if (remote.kind === 'not-found') return { kind: 'conflict', remote: null }
    if (remote.kind === 'invalid') return remote
    if (remote.kind === 'legacy-changed') {
      return { kind: 'conflict', remote: { document: remote.previous.document, remoteVersion: remote.remoteVersion } }
    }
    return remote
  }

  const saveNow = async (input: RemoteSaveInput): Promise<RemoteSaveResult> => {
    let navData: unknown
    try {
      navData = serializeNavConfigV2(input.document)
    } catch {
      return invalidInput('$.document', 'Workspace document is invalid.')
    }
    const updatedAt = now()
    if (!Number.isFinite(Date.parse(updatedAt))) {
      return invalidInput('$.updatedAt', 'Writer timestamp is invalid.')
    }
    const expectedRemoteVersion = input.expectedRemoteVersion
    const result = expectedRemoteVersion === null
      ? await safeGatewayCall(() => gateway.insert({
          userId: input.userId,
          navData,
          updatedAt,
        }))
      : await safeGatewayCall(() => gateway.updateIfVersion({
          userId: input.userId,
          expectedRemoteVersion,
          navData,
          updatedAt,
        }))

    if (result.kind === 'not-found') return conflictAfterMiss(input.userId)
    if (result.kind === 'error') {
      if (input.expectedRemoteVersion === null && isUniqueConflict(result.error)) {
        return conflictAfterMiss(input.userId)
      }
      return classifyError(result.error)
    }
    const parsed = parseRow(result.row, {})
    if (parsed.kind === 'loaded') return { kind: 'saved', snapshot: parsed.snapshot }
    if (parsed.kind === 'invalid') return parsed
    return {
      kind: 'failed',
      error: { code: 'DATA_INVALID', message: '远端返回的数据无效。', retryable: false },
    }
  }

  const save = (input: RemoteSaveInput): Promise<RemoteSaveResult> => {
    if (!writerEnabled) return Promise.resolve({ kind: 'writer-disabled' })
    if (!UUID_PATTERN.test(input.userId)) {
      return Promise.resolve(invalidInput('$.userId', 'User ID must be a UUID.'))
    }
    if (!UUID_PATTERN.test(input.mutationId)) {
      return Promise.resolve(invalidInput('$.mutationId', 'Mutation ID must be a UUID.'))
    }
    if (input.expectedRemoteVersion !== null && input.expectedRemoteVersion.trim().length === 0) {
      return Promise.resolve(invalidInput('$.expectedRemoteVersion', 'Remote version cannot be empty.'))
    }
    const existing = mutationFlights.get(input.mutationId)
    if (existing) return existing

    const task = saveTail.catch(() => undefined).then(() => saveNow(input))
    saveTail = task.then(() => undefined, () => undefined)
    mutationFlights.set(input.mutationId, task)
    void task.finally(() => mutationFlights.delete(input.mutationId)).catch(() => undefined)
    return task
  }

  return { load, save }
}
