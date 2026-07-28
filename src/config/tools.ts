import type { ComponentType } from 'react'

import type { ToolId } from '../types/workspace'

export type ToolPrivacy = 'local-only' | 'external-explicit'

export interface ToolDefinition {
  id: ToolId
  order: number
  path: string
  title: string
  aliases: readonly string[]
  description: string
  category: string
  iconKey: string
  keywords: readonly string[]
  privacy: ToolPrivacy
  load: () => Promise<{ default: ComponentType }>
}

export interface ToolRegistryIssue {
  code:
    | 'duplicate-id'
    | 'duplicate-order'
    | 'duplicate-path'
    | 'invalid-aliases'
    | 'invalid-category'
    | 'invalid-description'
    | 'invalid-icon'
    | 'invalid-id'
    | 'invalid-keywords'
    | 'invalid-loader'
    | 'invalid-order'
    | 'invalid-path'
    | 'invalid-privacy'
    | 'invalid-title'
    | 'invalid-type'
  index: number
  path: string
  message: string
}

const TOOL_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const TOOL_PATH_PATTERN = /^\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*$/

function asToolId(value: string): ToolId {
  return value as ToolId
}

function defineTool(definition: ToolDefinition): ToolDefinition {
  return definition
}

export const TOOL_REGISTRY = [
  defineTool({
    id: asToolId('network'),
    order: 0,
    path: '/tools/network',
    title: '网络与 IP',
    aliases: ['IP 工具', 'CIDR', '子网计算'],
    description: 'IP、CIDR、子网与网络地址计算。',
    category: '网络工具',
    iconKey: 'globe',
    keywords: ['ipv4', 'ipv6', 'network', 'subnet'],
    privacy: 'local-only',
    load: () => import('../pages/tools/NetworkTools'),
  }),
  defineTool({
    id: asToolId('security'),
    order: 1,
    path: '/tools/security',
    title: '证书与 RSA 密钥',
    aliases: ['RSA', 'X.509', 'HMAC'],
    description: '解析证书并生成或检查 RSA 与 HMAC 数据。',
    category: '安全与加解密',
    iconKey: 'shield-alert',
    keywords: ['certificate', 'pem', 'public key', 'private key'],
    privacy: 'local-only',
    load: () => import('../pages/tools/SecurityTools'),
  }),
  defineTool({
    id: asToolId('converter'),
    order: 2,
    path: '/tools/converter',
    title: '全能转换器',
    aliases: ['SQL 转换', '进制转换', 'Base 转换'],
    description: '格式化 SQL，并在常用数字进制之间转换。',
    category: '格式化与转换',
    iconKey: 'repeat',
    keywords: ['sql', 'binary', 'hex', 'decimal', 'base'],
    privacy: 'local-only',
    load: () => import('../pages/tools/ConverterTools'),
  }),
  defineTool({
    id: asToolId('json'),
    order: 3,
    path: '/tools/json',
    title: 'JSON / YAML 专业版',
    aliases: ['JSON 格式化', 'YAML 转换'],
    description: '格式化、校验并转换 JSON 与 YAML。',
    category: '格式化与转换',
    iconKey: 'file-json',
    keywords: ['json', 'yaml', 'format', 'validate'],
    privacy: 'local-only',
    load: () => import('../pages/tools/JsonTools'),
  }),
  defineTool({
    id: asToolId('docker'),
    order: 4,
    path: '/tools/docker',
    title: 'Docker 到 Compose',
    aliases: ['Docker Compose', '命令转换'],
    description: '把 docker run 命令转换为 Compose 配置。',
    category: '格式化与转换',
    iconKey: 'box',
    keywords: ['docker', 'compose', 'container'],
    privacy: 'local-only',
    load: () => import('../pages/tools/DockerTools'),
  }),
  defineTool({
    id: asToolId('text'),
    order: 5,
    path: '/tools/text',
    title: '文本手术刀',
    aliases: ['文本处理', '字符统计'],
    description: '清理、转换、排序和统计文本。',
    category: '文本处理',
    iconKey: 'type',
    keywords: ['text', 'case', 'sort', 'deduplicate'],
    privacy: 'local-only',
    load: () => import('../pages/tools/TextTools'),
  }),
  defineTool({
    id: asToolId('diff'),
    order: 6,
    path: '/tools/diff',
    title: '代码 Diff 对比',
    aliases: ['文本对比', '差异比较'],
    description: '并排比较两段代码或文本的差异。',
    category: '文本处理',
    iconKey: 'columns-2',
    keywords: ['diff', 'compare', 'patch'],
    privacy: 'local-only',
    load: () => import('../pages/tools/DiffViewer'),
  }),
  defineTool({
    id: asToolId('encode'),
    order: 7,
    path: '/tools/encode',
    title: 'URL / Base64 / JWT',
    aliases: ['编码解码', 'JWT 解码'],
    description: '编码或解码 URL、Base64，并查看 JWT 内容。',
    category: '文本处理',
    iconKey: 'code-2',
    keywords: ['url', 'base64', 'jwt', 'encode', 'decode'],
    privacy: 'local-only',
    load: () => import('../pages/tools/EncodeTools'),
  }),
  defineTool({
    id: asToolId('time'),
    order: 8,
    path: '/tools/time',
    title: 'Cron & 时间戳',
    aliases: ['Cron 表达式', 'Unix 时间戳'],
    description: '解释 Cron 表达式并转换 Unix 时间戳。',
    category: '时间与开发辅助',
    iconKey: 'clock',
    keywords: ['cron', 'timestamp', 'unix', 'date'],
    privacy: 'local-only',
    load: () => import('../pages/tools/TimeTools'),
  }),
  defineTool({
    id: asToolId('data'),
    order: 9,
    path: '/tools/data',
    title: 'Mock 数据 & UUID',
    aliases: ['随机数据', 'UUID 生成'],
    description: '生成 UUID、密码和常用测试数据。',
    category: '时间与开发辅助',
    iconKey: 'database',
    keywords: ['mock', 'uuid', 'password', 'random'],
    privacy: 'local-only',
    load: () => import('../pages/tools/DataTools'),
  }),
  defineTool({
    id: asToolId('crypto'),
    order: 10,
    path: '/tools/crypto',
    title: 'Hash & Bcrypt',
    aliases: ['哈希', '摘要计算'],
    description: '计算常用哈希并生成或校验 Bcrypt。',
    category: '安全与加解密',
    iconKey: 'hash',
    keywords: ['hash', 'bcrypt', 'md5', 'sha'],
    privacy: 'local-only',
    load: () => import('../pages/tools/CryptoTools'),
  }),
  defineTool({
    id: asToolId('cheatsheets'),
    order: 11,
    path: '/tools/cheatsheets',
    title: '命令备忘录',
    aliases: ['Cheatsheet', '速查表'],
    description: '检索常用开发命令与快捷参考。',
    category: '时间与开发辅助',
    iconKey: 'book-open',
    keywords: ['command', 'git', 'linux', 'reference'],
    privacy: 'local-only',
    load: () => import('../pages/tools/Cheatsheets'),
  }),
  defineTool({
    id: asToolId('media'),
    order: 12,
    path: '/tools/media',
    title: '多媒体与二维码',
    aliases: ['二维码', 'QR Code'],
    description: '生成二维码并处理常用多媒体数据。',
    category: '图像与多媒体',
    iconKey: 'image',
    keywords: ['qr', 'qrcode', 'image', 'media'],
    privacy: 'local-only',
    load: () => import('../pages/tools/MediaTools'),
  }),
] as const satisfies readonly ToolDefinition[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function addIssue(
  issues: ToolRegistryIssue[],
  code: ToolRegistryIssue['code'],
  index: number,
  path: string,
  message: string,
): void {
  issues.push({ code, index, path, message })
}

function validateStringArray(
  value: unknown,
  index: number,
  field: 'aliases' | 'keywords',
  issues: ToolRegistryIssue[],
): void {
  const code = field === 'aliases' ? 'invalid-aliases' : 'invalid-keywords'
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    addIssue(issues, code, index, `[${index}].${field}`, `${field} must contain only non-empty strings.`)
  }
}

export function validateToolRegistry(definitions: readonly unknown[]): ToolRegistryIssue[] {
  const issues: ToolRegistryIssue[] = []
  const seenIds = new Map<string, number>()
  const seenOrders = new Map<number, number>()
  const seenPaths = new Map<string, number>()

  definitions.forEach((definition, index) => {
    if (!isRecord(definition)) {
      addIssue(issues, 'invalid-type', index, `[${index}]`, 'Tool definition must be an object.')
      return
    }

    const id = definition.id
    if (typeof id !== 'string' || !TOOL_ID_PATTERN.test(id)) {
      addIssue(issues, 'invalid-id', index, `[${index}].id`, 'Tool ID must be a stable lowercase token.')
    } else if (seenIds.has(id)) {
      addIssue(issues, 'duplicate-id', index, `[${index}].id`, `Tool ID duplicates item ${seenIds.get(id)}.`)
    } else {
      seenIds.set(id, index)
    }

    const order = definition.order
    if (!Number.isInteger(order) || (order as number) < 0) {
      addIssue(issues, 'invalid-order', index, `[${index}].order`, 'Tool order must be a non-negative integer.')
    } else if (seenOrders.has(order as number)) {
      addIssue(
        issues,
        'duplicate-order',
        index,
        `[${index}].order`,
        `Tool order duplicates item ${seenOrders.get(order as number)}.`,
      )
    } else {
      seenOrders.set(order as number, index)
    }

    const path = definition.path
    if (typeof path !== 'string' || !TOOL_PATH_PATTERN.test(path)) {
      addIssue(issues, 'invalid-path', index, `[${index}].path`, 'Tool path must be an internal /tools/* route.')
    } else if (seenPaths.has(path)) {
      addIssue(issues, 'duplicate-path', index, `[${index}].path`, `Tool path duplicates item ${seenPaths.get(path)}.`)
    } else {
      seenPaths.set(path, index)
    }

    const requiredStrings: Array<[
      'title' | 'description' | 'category' | 'iconKey',
      ToolRegistryIssue['code'],
    ]> = [
      ['title', 'invalid-title'],
      ['description', 'invalid-description'],
      ['category', 'invalid-category'],
      ['iconKey', 'invalid-icon'],
    ]
    requiredStrings.forEach(([field, code]) => {
      if (typeof definition[field] !== 'string' || definition[field].trim().length === 0) {
        addIssue(issues, code, index, `[${index}].${field}`, `${field} must be a non-empty string.`)
      }
    })

    validateStringArray(definition.aliases, index, 'aliases', issues)
    validateStringArray(definition.keywords, index, 'keywords', issues)

    if (definition.privacy !== 'local-only' && definition.privacy !== 'external-explicit') {
      addIssue(
        issues,
        'invalid-privacy',
        index,
        `[${index}].privacy`,
        'Tool privacy must be local-only or external-explicit.',
      )
    }
    if (typeof definition.load !== 'function') {
      addIssue(issues, 'invalid-loader', index, `[${index}].load`, 'Tool loader must be a function.')
    }
  })

  return issues
}

export function assertValidToolRegistry(definitions: readonly unknown[]): void {
  const issues = validateToolRegistry(definitions)
  if (issues.length === 0) return
  throw new TypeError(
    `Invalid tool registry: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`,
  )
}

assertValidToolRegistry(TOOL_REGISTRY)
