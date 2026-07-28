import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

const mocks = vi.hoisted(() => ({
  configured: true,
  openCommandPalette: vi.fn(),
  signOut: vi.fn(),
  useAuth: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mocks.configured
  },
}))
vi.mock('./contexts/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('./domain/command-palette', () => ({ openCommandPalette: mocks.openCommandPalette }))
vi.mock('./components/Sidebar', () => ({
  Sidebar: (props: {
    collapsed: boolean
    mobileOpen: boolean
    userEmail?: string
    onCloseMobile: () => void
    onToggleCollapsed: () => void
    onSignOut: () => void
  }) => (
    <aside data-collapsed={props.collapsed} data-mobile-open={props.mobileOpen}>
      <span>{props.userEmail ?? 'anonymous'}</span>
      <button onClick={props.onCloseMobile}>Close navigation</button>
      <button onClick={props.onToggleCollapsed}>Toggle collapse</button>
      <button onClick={props.onSignOut}>Sign out</button>
    </aside>
  ),
}))
vi.mock('./components/AppHeader', () => ({
  AppHeader: ({ onToggleNavigation }: { onToggleNavigation: () => void }) => (
    <button onClick={onToggleNavigation}>Open navigation</button>
  ),
}))
vi.mock('./components/MobileNav', () => ({
  MobileNav: (props: {
    onOpenSearch: () => void
    onOpenTools: () => void
    onOpenMore: () => void
  }) => (
    <nav>
      <button onClick={props.onOpenSearch}>Open search</button>
      <button onClick={props.onOpenTools}>Open tools</button>
      <button onClick={props.onOpenMore}>Open more</button>
    </nav>
  ),
}))

function renderApp() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<h1>Dashboard content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.configured = true
  mocks.signOut.mockReset()
  mocks.openCommandPalette.mockReset()
  mocks.useAuth.mockReturnValue({ user: { email: 'owner@example.com' }, signOut: mocks.signOut })
})

describe('App layout', () => {
  it('blocks the workspace with actionable configuration guidance when Supabase is unavailable', () => {
    mocks.configured = false

    renderApp()

    expect(screen.getByRole('alert')).toHaveTextContent('Supabase')
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_SUPABASE_URL')
    expect(screen.queryByRole('heading', { name: 'Dashboard content' })).not.toBeInTheDocument()
  })

  it('renders nested content and coordinates desktop and mobile navigation state', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()
    const sidebar = screen.getByRole('complementary')

    expect(screen.getByRole('heading', { name: 'Dashboard content' })).toBeInTheDocument()
    expect(sidebar).toHaveTextContent('owner@example.com')
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    expect(container.querySelector('.app-layout')).not.toHaveClass('sidebar-is-collapsed')

    await user.click(screen.getByRole('button', { name: 'Toggle collapse' }))
    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    expect(container.querySelector('.app-layout')).toHaveClass('sidebar-is-collapsed')

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(sidebar).toHaveAttribute('data-mobile-open', 'true')
    await user.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(sidebar).toHaveAttribute('data-mobile-open', 'false')

    await user.click(screen.getByRole('button', { name: 'Open tools' }))
    expect(sidebar).toHaveAttribute('data-mobile-open', 'true')
    await user.click(screen.getByRole('button', { name: 'Close navigation' }))
    await user.click(screen.getByRole('button', { name: 'Open more' }))
    expect(sidebar).toHaveAttribute('data-mobile-open', 'true')

    await user.click(screen.getByRole('button', { name: 'Open search' }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mocks.openCommandPalette).toHaveBeenCalledOnce()
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('does not invent an email while the session user has no email claim', () => {
    mocks.useAuth.mockReturnValue({ user: {}, signOut: mocks.signOut })

    renderApp()

    expect(screen.getByRole('complementary')).toHaveTextContent('anonymous')
  })
})
