import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authPageMocks = vi.hoisted(() => ({
  signUpEnabled: false,
  useAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../contexts/useAuth', () => ({ useAuth: authPageMocks.useAuth }))
vi.mock('../lib/supabase', () => ({
  get isSignUpEnabled() {
    return authPageMocks.signUpEnabled
  },
  supabase: {
    auth: {
      signInWithPassword: authPageMocks.signInWithPassword,
      signUp: authPageMocks.signUp,
    },
  },
}))

import { safeAuthError } from '../domain/auth-errors'
import Auth from './Auth'

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/" element={<p>Home route</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Auth page', () => {
  beforeEach(() => {
    authPageMocks.signUpEnabled = false
    authPageMocks.useAuth.mockReset().mockReturnValue({ user: null, loading: false })
    authPageMocks.signInWithPassword.mockReset().mockResolvedValue({ error: null })
    authPageMocks.signUp.mockReset().mockResolvedValue({ error: null })
  })

  it('shows an accessible loading state while the session is being restored', () => {
    authPageMocks.useAuth.mockReturnValue({ user: null, loading: true })

    renderAuth()

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('main').querySelectorAll('.auth-loading-field')).toHaveLength(2)
  })

  it('redirects an authenticated user away from the login page', async () => {
    authPageMocks.useAuth.mockReturnValue({ user: { id: 'user-a' } as User, loading: false })

    renderAuth()

    expect(await screen.findByText('Home route')).toBeInTheDocument()
  })

  it('keeps registration hidden and submits a trimmed login without hiding password controls', async () => {
    const user = userEvent.setup()
    renderAuth()

    expect(screen.getByText(/私人工作台/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /创建/ })).not.toBeInTheDocument()

    const email = screen.getByLabelText('邮箱地址')
    const password = screen.getByLabelText('密码')
    await user.type(email, '  owner@example.com  ')
    await user.type(password, 'secret-password')
    await user.click(screen.getByRole('button', { name: '显示密码' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: '隐藏密码' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => expect(authPageMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret-password',
    }))
    expect(authPageMocks.signUp).not.toHaveBeenCalled()
  })

  it('shows a safe localized error without exposing the backend message', async () => {
    authPageMocks.signInWithPassword.mockResolvedValue({
      error: new Error('Invalid login credentials: internal trace 42'),
    })
    const user = userEvent.setup()
    renderAuth()

    await user.type(screen.getByLabelText('邮箱地址'), 'owner@example.com')
    await user.type(screen.getByLabelText('密码'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: '登录' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('邮箱或密码不正确')
    expect(alert).not.toHaveTextContent('internal trace 42')
  })

  it('supports the explicitly enabled sign-up flow and resets transient state when switching modes', async () => {
    authPageMocks.signUpEnabled = true
    const user = userEvent.setup()
    renderAuth()

    await user.click(screen.getByRole('button', { name: /没有账号/ }))
    expect(screen.getByRole('heading', { name: '创建账号' })).toBeInTheDocument()
    expect(screen.getByLabelText('密码')).toHaveAttribute('minlength', '8')
    expect(screen.getByLabelText('密码')).toHaveAttribute('autocomplete', 'new-password')

    await user.type(screen.getByLabelText('邮箱地址'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'new-password')
    await user.click(screen.getByRole('button', { name: '创建账号' }))

    expect(await screen.findByRole('status')).toHaveTextContent('账号已创建')
    expect(authPageMocks.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'new-password',
    })

    await user.click(screen.getByRole('button', { name: /返回登录/ }))
    expect(screen.getByRole('heading', { name: '欢迎回来' })).toBeInTheDocument()
    expect(screen.getByLabelText('密码')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ignores a repeated submit while an authentication request is pending', async () => {
    authPageMocks.signInWithPassword.mockReturnValue(new Promise(() => {}))
    renderAuth()

    fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret-password' } })
    const form = screen.getByRole('button', { name: '登录' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(authPageMocks.signInWithPassword).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /正在处理/ })).toBeDisabled()
  })
})

describe('safeAuthError', () => {
  it.each([
    ['Invalid login credentials', '邮箱或密码不正确'],
    ['Email not confirmed', '邮箱尚未验证'],
    ['User already registered', '已经注册'],
    ['Rate limit exceeded', '尝试次数过多'],
    ['Password is too weak', '密码强度不足'],
    ['socket disconnected with private diagnostic', '暂时无法完成认证'],
    [null, '暂时无法完成认证'],
  ])('maps %p to a safe user-facing message', (source, expected) => {
    const error = source === null ? { private: true } : new Error(source)
    expect(safeAuthError(error)).toContain(expected)
  })
})
