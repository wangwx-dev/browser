export type UUID = string & { readonly __brand: 'UUID' }
export type ISODateTime = string & { readonly __brand: 'ISODateTime' }
export type ToolId = string & { readonly __brand: 'ToolId' }
export type SafeHttpUrl = string & { readonly __brand: 'SafeHttpUrl' }
export type LegacySourceFingerprint = string & { readonly __brand: 'LegacySourceFingerprint' }

export type JsonPrimitive = null | boolean | number | string
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export interface NavConfigV2 {
  schemaVersion: 2
  configId: UUID
  revision: number
  updatedAt: ISODateTime
  categories: NavCategoryV2[]
  favorites: FavoriteV2[]
  recents: RecentV2[]
  extensions?: Record<string, JsonValue>
}

export type SerializedNavConfigV2 = NavConfigV2 & JsonObject

export interface NavCategoryV2 {
  id: UUID
  name: string
  order: number
  links: NavLinkV2[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
  extensions?: Record<string, JsonValue>
}

export interface NavLinkV2 {
  id: UUID
  name: string
  url: string
  description: string
  icon?: string
  order: number
  createdAt: ISODateTime
  updatedAt: ISODateTime
  extensions?: Record<string, JsonValue>
}

export type ResourceRefV2 =
  | { kind: 'site'; id: UUID }
  | { kind: 'tool'; id: ToolId }

export interface FavoriteV2 {
  ref: ResourceRefV2
  createdAt: ISODateTime
}

export interface RecentV2 {
  ref: ResourceRefV2
  openedAt: ISODateTime
}

export interface NavCategoryV1 {
  category?: unknown
  links?: unknown
  [key: string]: unknown
}

export type NavConfigV1 = NavCategoryV1[]

export interface SerializedNavLinkV1 {
  name: string
  url: string
  desc: string
  icon?: string
}

export interface SerializedNavCategoryV1 {
  category: string
  links: SerializedNavLinkV1[]
}

export type SerializedNavConfigV1 = SerializedNavCategoryV1[] & JsonValue[]

export interface LegacyShadow {
  sourceFingerprint: LegacySourceFingerprint
  document: NavConfigV2
}

export interface NavConfigIssue {
  code:
    | 'duplicate-id'
    | 'generator-failed'
    | 'invalid-id'
    | 'invalid-json'
    | 'invalid-order'
    | 'invalid-revision'
    | 'invalid-shadow'
    | 'invalid-timestamp'
    | 'invalid-type'
    | 'missing-field'
    | 'unknown-field'
  path: string
  message: string
}

export interface NavConfigWarning {
  code: 'unsafe-extension-key'
  path: string
  key: '__proto__' | 'prototype' | 'constructor'
  message: string
}

export interface ParseRemoteDocumentOptions {
  now?: string | (() => string)
  newId?: () => string
  shadow?: LegacyShadow
}

export type ParseRemoteDocumentResult =
  | {
      kind: 'valid-v2'
      document: NavConfigV2
      warnings: NavConfigWarning[]
    }
  | {
      kind: 'adapted-v1'
      document: NavConfigV2
      shadow: LegacyShadow
      sourceFingerprint: LegacySourceFingerprint
      reused: boolean
      reusedShadow: boolean
      warnings: NavConfigWarning[]
    }
  | {
      kind: 'legacy-changed'
      sourceFingerprint: LegacySourceFingerprint
      previousFingerprint: LegacySourceFingerprint
      previous: LegacyShadow
      warnings: NavConfigWarning[]
    }
  | {
      kind: 'invalid'
      issues: NavConfigIssue[]
      warnings: NavConfigWarning[]
    }

export type LegacySerializationLoss =
  | { kind: 'stable-ids'; count: number }
  | { kind: 'favorites'; count: number }
  | { kind: 'recents'; count: number }
  | { kind: 'root-extensions'; count: number }

export type LegacyLostCapability = 'stable-ids' | 'favorites' | 'recents'

export interface SerializeNavConfigV1Result {
  raw: SerializedNavConfigV1
  lostCapabilities: LegacyLostCapability[]
  losses: LegacySerializationLoss[]
}
