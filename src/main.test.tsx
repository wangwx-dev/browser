import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: {
    loading: false,
    user: null as { id: string; email?: string } | null,
  },
  workspaceUsers: [] as string[],
}))

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('./contexts/useAuth', () => ({
  useAuth: () => ({
    ...mocks.auth,
    session: null,
    signOut: vi.fn(),
  }),
}))

vi.mock('./contexts/WorkspaceContext', () => ({
  WorkspaceProvider: ({
    children,
    userId,
  }: {
    children: React.ReactNode
    userId: string
  }) => {
    mocks.workspaceUsers.push(userId)
    return <>{children}</>
  },
}))

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  isNavV2WriteEnabled: false,
  supabase: {},
}))

vi.mock('./App', () => ({
  default: () => (
    <div data-testid="app-shell">
      <Outlet />
    </div>
  ),
}))

vi.mock('./components/CommandPalette', () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}))

vi.mock('./components/ConflictDialog', () => ({
  ConflictDialog: () => null,
}))

vi.mock('./pages/Auth', async () => {
  function AuthPage() {
    const location = useLocation()
    return <div data-testid="auth-page">{location.search}</div>
  }
  return { default: AuthPage }
})

vi.mock('./pages/Dashboard', () => ({
  default: () => <h1>工作台首页</h1>,
}))

vi.mock('./pages/Navigation', () => ({
  default: () => <h1>导航管理</h1>,
}))

import { buildLoginPath, sanitizeReturnTo } from './domain/routing'
import { AppRoutes } from './main'

describe('safe returnTo routing', () => {
  it('accepts only same-origin absolute app paths', () => {
    expect(sanitizeReturnTo('/tools/json?mode=tree#result')).toBe('/tools/json?mode=tree#result')
    expect(sanitizeReturnTo('//evil.example/path')).toBe('/')
    expect(sanitizeReturnTo('https://evil.example/path')).toBe('/')
    expect(sanitizeReturnTo('/\\evil.example/path')).toBe('/')
    expect(sanitizeReturnTo('')).toBe('/')
  })

  it('encodes the complete protected location once', () => {
    expect(buildLoginPath('/tools/json?mode=tree#result')).toBe(
      '/login?returnTo=%2Ftools%2Fjson%3Fmode%3Dtree%23result',
    )
  })
})

describe('AppRoutes authentication boundary', () => {
  beforeEach(() => {
    mocks.auth.loading = false
    mocks.auth.user = null
    mocks.workspaceUsers.length = 0
  })

  it('redirects an anonymous deep link to login with a safe return target', async () => {
    render(
      <MemoryRouter initialEntries={['/navigation?editing=1#links']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('auth-page')).toHaveTextContent(
      '?returnTo=%2Fnavigation%3Fediting%3D1%23links',
    )
    expect(mocks.workspaceUsers).toEqual([])
  })

  it('renders the dashboard and singleton command palette inside the authenticated workspace', async () => {
    mocks.auth.user = { id: 'user-123', email: 'owner@example.com' }
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '工作台首页' })).toBeInTheDocument()
    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(screen.getByTestId('command-palette')).toBeInTheDocument()
    expect(mocks.workspaceUsers).toContain('user-123')
  })

  it('returns an authenticated user from login only to a sanitized target', async () => {
    mocks.auth.user = { id: 'user-123' }
    render(
      <MemoryRouter initialEntries={['/login?returnTo=https%3A%2F%2Fevil.example']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('heading', { name: '工作台首页' })).toBeInTheDocument())
  })

  it('renders a distinct 404 recovery page for an unknown route', async () => {
    mocks.auth.user = { id: 'user-123' }
    render(
      <MemoryRouter initialEntries={['/missing-page']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/')
  })
})
