import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabasePublicConfig {
  url: string
  publicKey: string
  navV2WriteEnabled: boolean
  signUpEnabled: boolean
}

export interface SupabaseConfigIssue {
  field: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'
  code: 'missing' | 'invalid-url' | 'placeholder' | 'secret-key'
  message: string
}

export type SupabasePublicConfigResult =
  | { ok: true; value: SupabasePublicConfig }
  | { ok: false; issues: SupabaseConfigIssue[] }

type PublicEnvironment = Readonly<Record<string, string | undefined>>

function hasPlaceholder(value: string): boolean {
  return /\[[^\]]+]|<[^>]+>|your[_-]?project|project[_-]?id|placeholder/i.test(value)
}

function hasServiceRoleClaim(value: string): boolean {
  const segments = value.split('.')
  if (segments.length !== 3) return false
  try {
    const payload = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const claims = JSON.parse(atob(paddedPayload)) as { role?: unknown }
    return claims.role === 'service_role'
  } catch {
    return false
  }
}

export function readSupabasePublicConfig(environment: PublicEnvironment): SupabasePublicConfigResult {
  const issues: SupabaseConfigIssue[] = []
  const urlValue = environment.VITE_SUPABASE_URL?.trim() ?? ''
  const publicKey = (
    environment.VITE_SUPABASE_ANON_KEY ?? environment.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  ).trim()

  if (!urlValue) {
    issues.push({
      field: 'VITE_SUPABASE_URL',
      code: 'missing',
      message: '缺少 Supabase 项目地址。',
    })
  } else if (hasPlaceholder(urlValue)) {
    issues.push({
      field: 'VITE_SUPABASE_URL',
      code: 'placeholder',
      message: 'Supabase 项目地址仍是占位值。',
    })
  } else {
    try {
      const parsed = new URL(urlValue)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new TypeError('Supabase URL must be a credential-free HTTPS URL.')
      }
    } catch {
      issues.push({
        field: 'VITE_SUPABASE_URL',
        code: 'invalid-url',
        message: 'Supabase 项目地址必须是有效的 HTTPS URL。',
      })
    }
  }

  if (!publicKey) {
    issues.push({
      field: 'VITE_SUPABASE_ANON_KEY',
      code: 'missing',
      message: '缺少 Supabase 浏览器公开密钥。',
    })
  } else if (
    publicKey.startsWith('sb_secret_') ||
    /service[_-]?role/i.test(publicKey) ||
    hasServiceRoleClaim(publicKey)
  ) {
    issues.push({
      field: 'VITE_SUPABASE_ANON_KEY',
      code: 'secret-key',
      message: '客户端不能使用 secret 或 service role 密钥。',
    })
  }

  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    value: {
      url: urlValue,
      publicKey,
      navV2WriteEnabled: environment.VITE_ENABLE_NAV_V2_WRITE === 'true',
      signUpEnabled: environment.VITE_ALLOW_SIGN_UP === 'true',
    },
  }
}

export const supabaseConfiguration = readSupabasePublicConfig(import.meta.env)
export const isSupabaseConfigured = supabaseConfiguration.ok
export const supabaseConfigIssues = supabaseConfiguration.ok ? [] : supabaseConfiguration.issues
export const isNavV2WriteEnabled =
  supabaseConfiguration.ok && supabaseConfiguration.value.navV2WriteEnabled
export const isSignUpEnabled =
  supabaseConfiguration.ok && supabaseConfiguration.value.signUpEnabled

const clientConfig = supabaseConfiguration.ok
  ? supabaseConfiguration.value
  : {
      url: 'https://placeholder.invalid',
      publicKey: 'sb_publishable_invalid-client-configuration',
      navV2WriteEnabled: false,
      signUpEnabled: false,
    }

export const supabase: SupabaseClient = createClient(clientConfig.url, clientConfig.publicKey)
