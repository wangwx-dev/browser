import { Eye, EyeOff, LogIn, TerminalSquare, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../contexts/useAuth'
import { safeAuthError } from '../domain/auth-errors'
import { isSignUpEnabled, supabase } from '../lib/supabase'
import './Auth.css'

export default function Auth() {
  const { user, loading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (loading) {
    return (
      <main className="auth-page" aria-busy="true">
        <section className="auth-card auth-card-loading">
          <div className="auth-loading-bar" />
          <div className="auth-loading-field" />
          <div className="auth-loading-field" />
        </section>
        <span className="sr-only">正在检查登录状态</span>
      </main>
    )
  }

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setErrorMessage('')
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        setSuccessMessage('账号已创建。若项目启用了邮箱验证，请先查看验证邮件。')
      }
    } catch (error) {
      setErrorMessage(safeAuthError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = () => {
    setIsLogin((value) => !value)
    setPassword('')
    setErrorMessage('')
    setSuccessMessage('')
    setShowPassword(false)
  }

  return (
    <main className="auth-page">
      <a className="auth-brand" href="/login" aria-label="个人开发工作台登录页">
        <TerminalSquare aria-hidden="true" size={22} />
        Dev Workbench
      </a>

      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-heading">
          <p className="auth-eyebrow">PERSONAL WORKSPACE</p>
          <h1 id="auth-title">{isLogin ? '欢迎回来' : '创建账号'}</h1>
          <p>{isLogin ? '登录你的个人开发工作台' : '创建仅供你使用的工作台账号'}</p>
        </header>

        {errorMessage ? <p className="auth-feedback auth-feedback-error" role="alert">{errorMessage}</p> : null}
        {successMessage ? <p className="auth-feedback auth-feedback-success" role="status">{successMessage}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field" htmlFor="auth-email">
            <span>邮箱地址</span>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              disabled={isSubmitting}
              required
            />
          </label>

          <label className="auth-field" htmlFor="auth-password">
            <span>密码</span>
            <span className="auth-password-control">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="至少 6 位"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                disabled={isSubmitting}
                minLength={isLogin ? 6 : 8}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            </span>
          </label>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isLogin ? <LogIn aria-hidden="true" size={18} /> : <UserPlus aria-hidden="true" size={18} />}
            {isSubmitting ? '正在处理…' : isLogin ? '登录' : '创建账号'}
          </button>
        </form>

        {isSignUpEnabled ? (
          <button type="button" className="auth-mode-switch" onClick={switchMode} disabled={isSubmitting}>
            {isLogin ? '没有账号？创建一个' : '已有账号？返回登录'}
          </button>
        ) : (
          <p className="auth-private-note">这是私人工作台，新账号注册入口已关闭。</p>
        )}
      </section>
    </main>
  )
}
