import { describe, expect, it } from 'vitest'

import {
  assertValidToolRegistry,
  TOOL_REGISTRY,
  validateToolRegistry,
} from './tools'

describe('TOOL_REGISTRY', () => {
  it('contains the 13 existing tool routes with stable IDs and explicit order', () => {
    expect(TOOL_REGISTRY.map((tool) => tool.id)).toEqual([
      'network',
      'security',
      'converter',
      'json',
      'docker',
      'text',
      'diff',
      'encode',
      'time',
      'data',
      'crypto',
      'cheatsheets',
      'media',
    ])
    expect(TOOL_REGISTRY.map((tool) => tool.order)).toEqual(
      Array.from({ length: 13 }, (_, index) => index),
    )
    expect(validateToolRegistry(TOOL_REGISTRY)).toEqual([])
  })

  it('uses unique internal paths and lazy loader functions', () => {
    const paths = TOOL_REGISTRY.map((tool) => tool.path)

    expect(new Set(paths).size).toBe(paths.length)
    expect(paths.every((path) => path.startsWith('/tools/'))).toBe(true)
    expect(TOOL_REGISTRY.every((tool) => typeof tool.load === 'function')).toBe(true)
  })

  it('reports duplicate IDs, orders and paths instead of silently overwriting them', () => {
    const first = TOOL_REGISTRY[0]
    const issues = validateToolRegistry([
      first,
      {
        ...TOOL_REGISTRY[1],
        id: first.id,
        order: first.order,
        path: first.path,
      },
    ])

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate-id', 'duplicate-order', 'duplicate-path']),
    )
    expect(() => assertValidToolRegistry([first, { ...first }])).toThrow(/Invalid tool registry/)
  })

  it('rejects external routes, empty metadata and non-function loaders', () => {
    const invalid = {
      ...TOOL_REGISTRY[0],
      id: 'Network Tool',
      path: 'https://example.com/tool',
      title: ' ',
      aliases: [''],
      keywords: [42],
      privacy: 'implicit-network',
      load: 'eager-module',
    }

    expect(validateToolRegistry([invalid]).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'invalid-id',
        'invalid-path',
        'invalid-title',
        'invalid-aliases',
        'invalid-keywords',
        'invalid-privacy',
        'invalid-loader',
      ]),
    )
  })
})
