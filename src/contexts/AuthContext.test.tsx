import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signOut: authMocks.signOut,
    },
  },
}))

import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

function session(userId: string): Session {
  return {
    user: { id: userId } as User,
  } as Session
}

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="user">{auth.user?.id ?? 'signed-out'}</span>
      <button type="button" onClick={() => void auth.signOut()}>Sign out</button>
    </div>
  )
}

describe('AuthProvider', () => {
  let notifyAuthChange: (event: AuthChangeEvent, nextSession: Session | null) => void

  beforeEach(() => {
    authMocks.getSession.mockReset()
    authMocks.onAuthStateChange.mockReset()
    authMocks.signOut.mockReset().mockResolvedValue({ error: null })
    authMocks.unsubscribe.mockReset()
    authMocks.onAuthStateChange.mockImplementation((callback) => {
      notifyAuthChange = callback
      return { data: { subscription: { unsubscribe: authMocks.unsubscribe } } }
    })
  })

  it('hydrates the initial session and delegates sign-out', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: session('user-a') }, error: null })
    const user = userEvent.setup()

    const view = render(<AuthProvider><Probe /></AuthProvider>)

    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user-a'))
    expect(screen.getByTestId('loading')).toHaveTextContent('false')

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(authMocks.signOut).toHaveBeenCalledOnce()

    view.unmount()
    expect(authMocks.unsubscribe).toHaveBeenCalledOnce()
  })

  it('turns a failed initial session lookup into a usable signed-out state', async () => {
    authMocks.getSession.mockRejectedValue(new Error('network unavailable'))

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('user')).toHaveTextContent('signed-out')
  })

  it('does not let a stale initial snapshot overwrite a newer auth event', async () => {
    let resolveInitial!: (value: { data: { session: Session | null }; error: null }) => void
    authMocks.getSession.mockReturnValue(new Promise((resolve) => { resolveInitial = resolve }))

    render(<AuthProvider><Probe /></AuthProvider>)

    act(() => notifyAuthChange('SIGNED_IN', session('new-user')))
    expect(screen.getByTestId('user')).toHaveTextContent('new-user')

    await act(async () => resolveInitial({ data: { session: session('stale-user') }, error: null }))
    expect(screen.getByTestId('user')).toHaveTextContent('new-user')
  })

  it('applies later sign-out events and ignores work after unmount', async () => {
    let resolveInitial!: (value: { data: { session: Session | null }; error: null }) => void
    authMocks.getSession.mockReturnValue(new Promise((resolve) => { resolveInitial = resolve }))
    const view = render(<AuthProvider><Probe /></AuthProvider>)

    act(() => notifyAuthChange('SIGNED_IN', session('user-a')))
    act(() => notifyAuthChange('SIGNED_OUT', null))
    expect(screen.getByTestId('user')).toHaveTextContent('signed-out')

    view.unmount()
    await act(async () => resolveInitial({ data: { session: session('stale-user') }, error: null }))
    expect(authMocks.unsubscribe).toHaveBeenCalledOnce()
  })
})
