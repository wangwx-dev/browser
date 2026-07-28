import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ISODateTime,
  NavConfigV2,
  UUID,
} from '../types/workspace'
import {
  createSupabaseWorkspaceGateway,
  createWorkspaceRepository,
  type WorkspaceGateway,
  type WorkspaceGatewayResult,
} from './workspace-repository'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CONFIG_ID = '22222222-2222-4222-8222-222222222222' as UUID
const MUTATION_ID = '33333333-3333-4333-8333-333333333333' as UUID
const NOW = '2026-07-28T04:00:00.000Z' as ISODateTime

function document(revision = 1): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: CONFIG_ID,
    revision,
    updatedAt: NOW,
    categories: [],
    favorites: [],
    recents: [],
  }
}

function gateway(overrides: Partial<WorkspaceGateway> = {}): WorkspaceGateway {
  return {
    load: vi.fn(async () => ({ kind: 'not-found' }) as WorkspaceGatewayResult),
    insert: vi.fn(async () => ({ kind: 'row', row: { navData: document(), updatedAt: NOW } }) as WorkspaceGatewayResult),
    updateIfVersion: vi.fn(async () => ({ kind: 'row', row: { navData: document(2), updatedAt: NOW } }) as WorkspaceGatewayResult),
    ...overrides,
  }
}

describe('Supabase workspace gateway', () => {
  it('selects only the workspace fields and applies user plus updated_at CAS filters', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { nav_data: document(), updated_at: NOW },
      error: null,
    }))
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.maybeSingle = maybeSingle
    const from = vi.fn(() => chain)
    const remote = createSupabaseWorkspaceGateway({ from } as unknown as SupabaseClient)

    await remote.load(USER_ID)
    await remote.updateIfVersion({
      userId: USER_ID,
      expectedRemoteVersion: NOW,
      navData: document(2),
      updatedAt: '2026-07-28T04:00:01.000Z',
    })

    expect(from).toHaveBeenCalledWith('user_nav_configs')
    expect(chain.select).toHaveBeenCalledWith('nav_data,updated_at')
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(chain.eq).toHaveBeenCalledWith('updated_at', NOW)
  })

  it('maps inserts, empty rows, invalid responses, API errors, and thrown client failures', async () => {
    const single = vi.fn(async () => ({ data: { nav_data: document(), updated_at: NOW }, error: null }))
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.insert = vi.fn(() => chain)
    chain.update = vi.fn(() => chain)
    chain.single = single
    chain.maybeSingle = maybeSingle
    const from = vi.fn(() => chain)
    const remote = createSupabaseWorkspaceGateway({ from } as unknown as SupabaseClient)

    expect(await remote.insert({ userId: USER_ID, navData: document(), updatedAt: NOW })).toMatchObject({
      kind: 'row',
      row: { updatedAt: NOW },
    })
    expect(chain.insert).toHaveBeenCalledWith({ user_id: USER_ID, nav_data: document(), updated_at: NOW })
    expect(await remote.updateIfVersion({
      userId: USER_ID,
      navData: document(),
      updatedAt: NOW,
      expectedRemoteVersion: NOW,
    })).toEqual({ kind: 'not-found' })

    single.mockResolvedValueOnce({ data: [], error: null } as never)
    expect((await remote.insert({ userId: USER_ID, navData: document(), updatedAt: NOW })).kind).toBe('error')
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '42501' } } as never)
    expect((await remote.load(USER_ID)).kind).toBe('error')

    from.mockImplementationOnce(() => { throw new TypeError('network down') })
    expect((await remote.load(USER_ID)).kind).toBe('error')
    from.mockImplementationOnce(() => { throw new Error('insert crashed') })
    expect((await remote.insert({ userId: USER_ID, navData: document(), updatedAt: NOW })).kind).toBe('error')
    from.mockImplementationOnce(() => { throw new Error('update crashed') })
    expect((await remote.updateIfVersion({
      userId: USER_ID,
      navData: document(),
      updatedAt: NOW,
      expectedRemoteVersion: NOW,
    })).kind).toBe('error')
  })
})

describe('workspace repository load', () => {
  it('adapts a legacy row once and returns its reusable shadow without mutating remote data', async () => {
    const raw = [{ category: '开发', links: [{ name: 'Docs', url: 'https://example.com', desc: '文档' }] }]
    const remote = structuredClone(raw)
    const remoteGateway = gateway({
      load: vi.fn(async () => ({ kind: 'row', row: { navData: raw, updatedAt: NOW } }) as WorkspaceGatewayResult),
    })
    const ids = [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ]
    const repository = createWorkspaceRepository({
      gateway: remoteGateway,
      writerEnabled: false,
      now: () => NOW,
      newId: () => ids.shift()!,
    })

    const result = await repository.load({ userId: USER_ID })

    expect(result.kind).toBe('loaded')
    if (result.kind !== 'loaded') return
    expect(result.source).toBe('v1')
    expect(result.snapshot.remoteVersion).toBe(NOW)
    expect(result.legacyShadow?.document).toEqual(result.snapshot.document)
    expect(raw).toEqual(remote)
  })

  it('returns data-invalid for malformed v2 and never treats it as not-found', async () => {
    const remoteGateway = gateway({
      load: vi.fn(async () => ({
        kind: 'row',
        row: { navData: { schemaVersion: 2, categories: [] }, updatedAt: NOW },
      }) as WorkspaceGatewayResult),
    })
    const repository = createWorkspaceRepository({ gateway: remoteGateway, writerEnabled: false })

    const result = await repository.load({ userId: USER_ID })

    expect(result.kind).toBe('invalid')
    if (result.kind === 'invalid') expect(result.issues.length).toBeGreaterThan(0)
  })

  it.each([
    [{ status: 401, code: 'PGRST301' }, 'unauthorized'],
    [{ status: 403, code: '42501' }, 'forbidden'],
    [new TypeError('Failed to fetch'), 'retryable'],
  ] as const)('classifies gateway error %p as %s', async (error, expected) => {
    const repository = createWorkspaceRepository({
      gateway: gateway({ load: vi.fn(async () => ({ kind: 'error', error }) as WorkspaceGatewayResult) }),
      writerEnabled: false,
    })

    expect((await repository.load({ userId: USER_ID })).kind).toBe(expected)
  })

  it('rejects invalid user IDs before accessing the gateway and preserves not-found', async () => {
    const remoteGateway = gateway()
    const repository = createWorkspaceRepository({ gateway: remoteGateway, writerEnabled: false })

    expect((await repository.load({ userId: 'not-a-uuid' })).kind).toBe('invalid')
    expect(remoteGateway.load).not.toHaveBeenCalled()
    expect((await repository.load({ userId: USER_ID })).kind).toBe('not-found')
  })

  it('rejects rows without a usable remote version', async () => {
    const repository = createWorkspaceRepository({
      gateway: gateway({
        load: vi.fn(async () => ({ kind: 'row', row: { navData: document(), updatedAt: '  ' } } as WorkspaceGatewayResult)),
      }),
      writerEnabled: false,
    })

    const result = await repository.load({ userId: USER_ID })
    expect(result).toMatchObject({ kind: 'invalid', issues: [{ path: '$.updated_at' }] })
  })

  it.each([
    [{ code: 'JWT_EXPIRED' }, 'unauthorized'],
    [{ code: '42501' }, 'forbidden'],
    [{ status: 0 }, 'retryable'],
    [{ status: 503 }, 'retryable'],
    [{ message: 'request timeout' }, 'retryable'],
    [{ code: 'SOMETHING_ELSE' }, 'failed'],
    [null, 'failed'],
    ['plain failure', 'failed'],
  ] as const)('classifies additional gateway failure %p as %s', async (error, expected) => {
    const repository = createWorkspaceRepository({
      gateway: gateway({ load: vi.fn(async () => ({ kind: 'error', error } as WorkspaceGatewayResult)) }),
      writerEnabled: false,
    })

    expect((await repository.load({ userId: USER_ID })).kind).toBe(expected)
  })

  it('contains a gateway implementation that rejects instead of returning a result', async () => {
    const repository = createWorkspaceRepository({
      gateway: gateway({ load: vi.fn(async () => { throw new TypeError('Failed to fetch') }) }),
      writerEnabled: false,
    })

    expect((await repository.load({ userId: USER_ID })).kind).toBe('retryable')
  })
})

describe('workspace repository save', () => {
  it('does not call the gateway while the rollout writer flag is disabled', async () => {
    const remoteGateway = gateway()
    const repository = createWorkspaceRepository({ gateway: remoteGateway, writerEnabled: false })

    const result = await repository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    })

    expect(result.kind).toBe('writer-disabled')
    expect(remoteGateway.updateIfVersion).not.toHaveBeenCalled()
    expect(remoteGateway.insert).not.toHaveBeenCalled()
  })

  it('uses user and expected updated_at as the conditional update token', async () => {
    const updateIfVersion = vi.fn(async (): Promise<WorkspaceGatewayResult> => ({
      kind: 'row',
      row: { navData: document(2), updatedAt: '2026-07-28T04:00:01.000Z' },
    }))
    const repository = createWorkspaceRepository({
      gateway: gateway({ updateIfVersion }),
      writerEnabled: true,
      now: () => '2026-07-28T04:00:01.000Z',
    })

    const result = await repository.save({
      userId: USER_ID,
      document: document(2),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    })

    expect(result.kind).toBe('saved')
    expect(updateIfVersion).toHaveBeenCalledWith({
      userId: USER_ID,
      expectedRemoteVersion: NOW,
      navData: document(2),
      updatedAt: '2026-07-28T04:00:01.000Z',
    })
  })

  it('re-reads after a conditional miss and reports the newer remote as conflict', async () => {
    const newer = { ...document(3), updatedAt: '2026-07-28T04:00:03.000Z' as ISODateTime }
    const remoteGateway = gateway({
      updateIfVersion: vi.fn(async () => ({ kind: 'not-found' }) as WorkspaceGatewayResult),
      load: vi.fn(async () => ({
        kind: 'row',
        row: { navData: newer, updatedAt: newer.updatedAt },
      }) as WorkspaceGatewayResult),
    })
    const repository = createWorkspaceRepository({ gateway: remoteGateway, writerEnabled: true })

    const result = await repository.save({
      userId: USER_ID,
      document: document(2),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    })

    expect(result.kind).toBe('conflict')
    if (result.kind === 'conflict') expect(result.remote?.document.revision).toBe(3)
  })

  it('re-reads a unique insert conflict instead of overwriting or retrying insert', async () => {
    const remoteGateway = gateway({
      insert: vi.fn(async () => ({ kind: 'error', error: { status: 409, code: '23505' } }) as WorkspaceGatewayResult),
      load: vi.fn(async () => ({ kind: 'row', row: { navData: document(), updatedAt: NOW } }) as WorkspaceGatewayResult),
    })
    const repository = createWorkspaceRepository({ gateway: remoteGateway, writerEnabled: true })

    const result = await repository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: null,
      mutationId: MUTATION_ID,
    })

    expect(result.kind).toBe('conflict')
    expect(remoteGateway.insert).toHaveBeenCalledOnce()
    expect(remoteGateway.load).toHaveBeenCalledOnce()
  })

  it('deduplicates the same mutation and serializes different mutations', async () => {
    let active = 0
    let maxActive = 0
    const releases: Array<() => void> = []
    const updateIfVersion = vi.fn(async ({ navData }: { navData: unknown }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active -= 1
      return { kind: 'row', row: { navData, updatedAt: NOW } } as WorkspaceGatewayResult
    })
    const repository = createWorkspaceRepository({
      gateway: gateway({ updateIfVersion }),
      writerEnabled: true,
    })
    const firstInput = {
      userId: USER_ID,
      document: document(2),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    }
    const secondInput = {
      ...firstInput,
      document: document(3),
      mutationId: '44444444-4444-4444-8444-444444444444' as UUID,
    }

    const first = repository.save(firstInput)
    const duplicate = repository.save(firstInput)
    const second = repository.save(secondInput)
    await vi.waitFor(() => expect(updateIfVersion).toHaveBeenCalledTimes(1))
    releases.shift()?.()
    await vi.waitFor(() => expect(updateIfVersion).toHaveBeenCalledTimes(2))
    releases.shift()?.()

    expect(await first).toEqual(await duplicate)
    await second
    expect(maxActive).toBe(1)
    expect(updateIfVersion).toHaveBeenCalledTimes(2)
  })

  it.each([
    [{ userId: 'bad', mutationId: MUTATION_ID, expectedRemoteVersion: NOW }, '$.userId'],
    [{ userId: USER_ID, mutationId: 'bad' as UUID, expectedRemoteVersion: NOW }, '$.mutationId'],
    [{ userId: USER_ID, mutationId: MUTATION_ID, expectedRemoteVersion: '  ' }, '$.expectedRemoteVersion'],
  ])('rejects invalid save metadata before writing (%s)', async (partial, issuePath) => {
    const remoteGateway = gateway()
    const repository = createWorkspaceRepository({ gateway: remoteGateway, writerEnabled: true })

    const result = await repository.save({ document: document(), ...partial })

    expect(result).toMatchObject({ kind: 'invalid', issues: [{ path: issuePath }] })
    expect(remoteGateway.insert).not.toHaveBeenCalled()
    expect(remoteGateway.updateIfVersion).not.toHaveBeenCalled()
  })

  it('rejects invalid documents and writer timestamps without calling the gateway', async () => {
    const remoteGateway = gateway()
    const invalidDocument = { ...document(), categories: null } as unknown as NavConfigV2
    const repository = createWorkspaceRepository({ gateway: remoteGateway, writerEnabled: true, now: () => 'not-a-date' })

    expect((await repository.save({
      userId: USER_ID,
      document: invalidDocument,
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    })).kind).toBe('invalid')
    expect((await repository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: NOW,
      mutationId: '44444444-4444-4444-8444-444444444444' as UUID,
    })).kind).toBe('invalid')
    expect(remoteGateway.updateIfVersion).not.toHaveBeenCalled()
  })

  it('inserts a first snapshot and returns the server version', async () => {
    const insert = vi.fn(async () => ({
      kind: 'row',
      row: { navData: document(), updatedAt: '2026-07-28T05:00:00.000Z' },
    }) as WorkspaceGatewayResult)
    const repository = createWorkspaceRepository({
      gateway: gateway({ insert }),
      writerEnabled: true,
      now: () => '2026-07-28T05:00:00.000Z',
    })

    const result = await repository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: null,
      mutationId: MUTATION_ID,
    })

    expect(result).toMatchObject({ kind: 'saved', snapshot: { remoteVersion: '2026-07-28T05:00:00.000Z' } })
    expect(insert).toHaveBeenCalledOnce()
  })

  it('reports a conflict with no snapshot when a missed write is still absent', async () => {
    const repository = createWorkspaceRepository({
      gateway: gateway({ updateIfVersion: vi.fn(async () => ({ kind: 'not-found' } as WorkspaceGatewayResult)) }),
      writerEnabled: true,
    })

    const result = await repository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    })

    expect(result).toEqual({ kind: 'conflict', remote: null })
  })

  it.each([
    [{ status: 401 }, 'unauthorized'],
    [{ status: 403 }, 'forbidden'],
    [{ status: 500 }, 'retryable'],
    [{ code: 'UNKNOWN' }, 'failed'],
  ] as const)('classifies conditional-write error %p as %s', async (error, expected) => {
    const repository = createWorkspaceRepository({
      gateway: gateway({ updateIfVersion: vi.fn(async () => ({ kind: 'error', error } as WorkspaceGatewayResult)) }),
      writerEnabled: true,
    })

    expect((await repository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    })).kind).toBe(expected)
  })

  it('returns invalid for malformed v2 and safely adapts a legacy echo', async () => {
    const invalidRepository = createWorkspaceRepository({
      gateway: gateway({
        updateIfVersion: vi.fn(async () => ({ kind: 'row', row: { navData: { schemaVersion: 2 }, updatedAt: NOW } } as WorkspaceGatewayResult)),
      }),
      writerEnabled: true,
    })
    const legacyRepository = createWorkspaceRepository({
      gateway: gateway({
        updateIfVersion: vi.fn(async () => ({
          kind: 'row',
          row: { navData: [{ category: 'Legacy', links: [] }], updatedAt: NOW },
        } as WorkspaceGatewayResult)),
      }),
      writerEnabled: true,
      newId: () => CONFIG_ID,
      now: () => NOW,
    })

    expect((await invalidRepository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    })).kind).toBe('invalid')
    expect((await legacyRepository.save({
      userId: USER_ID,
      document: document(),
      expectedRemoteVersion: NOW,
      mutationId: MUTATION_ID,
    }))).toMatchObject({ kind: 'saved', snapshot: { remoteVersion: NOW } })
  })
})
