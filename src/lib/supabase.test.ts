import { describe, expect, it } from 'vitest'

import { readSupabasePublicConfig } from './supabase'

describe('readSupabasePublicConfig', () => {
  it('accepts an HTTPS project URL and a public browser key', () => {
    expect(
      readSupabasePublicConfig({
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_example-browser-key',
        VITE_ENABLE_NAV_V2_WRITE: 'true',
      }),
    ).toEqual({
      ok: true,
      value: {
        url: 'https://project-ref.supabase.co',
        publicKey: 'sb_publishable_example-browser-key',
        navV2WriteEnabled: true,
        signUpEnabled: false,
      },
    })
  })

  it('keeps self-service sign-up disabled unless explicitly enabled', () => {
    const disabled = readSupabasePublicConfig({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_example-browser-key',
    })
    const enabled = readSupabasePublicConfig({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_example-browser-key',
      VITE_ALLOW_SIGN_UP: 'true',
    })

    expect(disabled.ok && disabled.value.signUpEnabled).toBe(false)
    expect(enabled.ok && enabled.value.signUpEnabled).toBe(true)
  })

  it('keeps the v2 writer disabled unless the flag is exactly true', () => {
    const result = readSupabasePublicConfig({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_example-browser-key',
      VITE_ENABLE_NAV_V2_WRITE: 'TRUE',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.navV2WriteEnabled).toBe(false)
  })

  it('rejects placeholders, non-HTTPS URLs, secret keys and missing values without echoing keys', () => {
    const serviceRolePayload = btoa(JSON.stringify({ role: 'service_role' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const cases = [
      {},
      {
        VITE_SUPABASE_URL: 'https://[YOUR_PROJECT_ID].supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_example-browser-key',
      },
      {
        VITE_SUPABASE_URL: 'http://project-ref.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_example-browser-key',
      },
      {
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_ANON_KEY: ['sb_secret', 'server-only-key'].join('_'),
      },
      {
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_ANON_KEY: `header.${serviceRolePayload}.signature`,
      },
    ]

    cases.forEach((environment) => {
      const result = readSupabasePublicConfig(environment)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.issues.length).toBeGreaterThan(0)
        expect(JSON.stringify(result.issues)).not.toContain('server-only-key')
      }
    })
  })
})
