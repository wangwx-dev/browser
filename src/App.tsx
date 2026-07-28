import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { AppHeader } from './components/AppHeader'
import { MobileNav } from './components/MobileNav'
import { Sidebar } from './components/Sidebar'
import { useAuth } from './contexts/useAuth'
import { openCommandPalette } from './domain/command-palette'
import { isSupabaseConfigured } from './lib/supabase'
import './App.css'

function ConfigurationError() {
  return (
    <main className="configuration-error">
      <section className="tool-card" role="alert">
        <h1>Supabase 配置不可用</h1>
        <p>
          请在 Cloudflare Workers 构建变量中配置有效的 <code>VITE_SUPABASE_URL</code> 与公开客户端密钥，
          然后重新部署。
        </p>
        <p className="configuration-hint">
          地址应类似 <code>https://project-id.supabase.co</code>，不能包含占位符、中括号或 service role 密钥。
        </p>
      </section>
    </main>
  )
}

function App() {
  const { user, signOut } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)

  if (!isSupabaseConfigured) return <ConfigurationError />

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavigationOpen}
        userEmail={user?.email}
        onCloseMobile={() => setMobileNavigationOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onSignOut={() => signOut()}
      />
      <div className="app-frame">
        <AppHeader onToggleNavigation={() => setMobileNavigationOpen(true)} />
        <main className="main-content" id="main-content">
          <Outlet />
        </main>
      </div>
      <MobileNav
        onOpenSearch={openCommandPalette}
        onOpenTools={() => setMobileNavigationOpen(true)}
        onOpenMore={() => setMobileNavigationOpen(true)}
      />
    </div>
  )
}

export default App
