import {
  Component,
  StrictMode,
  Suspense,
  lazy,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom'

import App from './App'
import { CommandPalette } from './components/CommandPalette'
import { TOOL_REGISTRY } from './config/tools'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { WorkspaceProvider } from './contexts/WorkspaceContext'
import initialData from './data.json'
import { parseRemoteDocument } from './domain/nav-config'
import { buildLoginPath, sanitizeReturnTo } from './domain/routing'
import { isNavV2WriteEnabled, isSupabaseConfigured, supabase } from './lib/supabase'
import {
  createSupabaseWorkspaceGateway,
  createWorkspaceRepository,
} from './services/workspace-repository'
import type { LegacyShadow, NavConfigV2 } from './types/workspace'
import './index.css'

const AuthPage = lazy(() => import('./pages/Auth'))
const DashboardPage = lazy(() => import('./pages/Dashboard'))
const NavigationPage = lazy(() => import('./pages/Navigation'))
const ConflictDialog = lazy(() => import('./components/ConflictDialog').then((module) => ({
  default: module.ConflictDialog,
})))
const TOOL_ROUTES = TOOL_REGISTRY.map((tool) => ({
  id: tool.id,
  path: tool.path.slice(1),
  Page: lazy(tool.load),
}))

interface InitialWorkspace {
  document: NavConfigV2
  legacyShadow: LegacyShadow
}

let initialWorkspace: InitialWorkspace | undefined
const workspaceRepository = isSupabaseConfigured
  ? createWorkspaceRepository({
      gateway: createSupabaseWorkspaceGateway(supabase),
      writerEnabled: isNavV2WriteEnabled,
    })
  : undefined

function getInitialWorkspace(): InitialWorkspace {
  if (initialWorkspace) return initialWorkspace
  const parsed = parseRemoteDocument(initialData, {
    now: () => new Date().toISOString(),
    newId: () => globalThis.crypto.randomUUID(),
  })
  if (parsed.kind !== 'adapted-v1') {
    throw new TypeError('Bundled navigation fallback is invalid.')
  }
  initialWorkspace = {
    document: parsed.document,
    legacyShadow: parsed.shadow,
  }
  return initialWorkspace
}

function RouteFallback({ label = '正在载入页面…' }: { label?: string }) {
  return (
    <main className="route-state" aria-busy="true" aria-label={label}>
      <div className="route-state-spinner" aria-hidden="true" />
      <p>{label}</p>
    </main>
  )
}

function AuthGate() {
  const { loading, user } = useAuth()
  const location = useLocation()

  if (loading) return <RouteFallback label="正在检查登录状态…" />
  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace to={buildLoginPath(returnTo)} />
  }
  return <Outlet />
}

function PublicAuthRoute() {
  const { loading, user } = useAuth()
  const [searchParams] = useSearchParams()

  if (!isSupabaseConfigured) {
    return (
      <main className="route-state" role="alert">
        <h1>Supabase 配置不可用</h1>
        <p>
          请在 Cloudflare Workers 构建变量中配置有效的 <code>VITE_SUPABASE_URL</code> 与浏览器公开密钥后重新部署。
        </p>
        <p>当前页面不会尝试连接占位地址，也不会输出任何密钥内容。</p>
      </main>
    )
  }
  if (loading) return <RouteFallback label="正在检查登录状态…" />
  if (user) return <Navigate replace to={sanitizeReturnTo(searchParams.get('returnTo'))} />
  return <AuthPage />
}

function AuthenticatedWorkspace() {
  const { user } = useAuth()
  if (!user) return null
  const fallback = getInitialWorkspace()

  return (
    <WorkspaceProvider
      key={user.id}
      userId={user.id}
      initialDocument={fallback.document}
      initialLegacyShadow={fallback.legacyShadow}
      repository={workspaceRepository}
      remoteWriterEnabled={isNavV2WriteEnabled}
    >
      <CommandPalette />
      <Suspense fallback={null}><ConflictDialog /></Suspense>
      <Outlet />
    </WorkspaceProvider>
  )
}

function NotFoundPage() {
  return (
    <main className="route-state" role="main">
      <p className="route-state-code">404</p>
      <h1>页面不存在</h1>
      <p>这个站内地址不存在，或对应工具已被移动。</p>
      <Link className="btn" to="/">返回首页</Link>
    </main>
  )
}

interface ErrorBoundaryState {
  failed: boolean
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 生产界面不输出可能包含个人数据的错误上下文。
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="route-state" role="alert">
        <h1>页面加载失败</h1>
        <p>本机草稿仍会保留。你可以重新载入，或先返回首页。</p>
        <div className="route-state-actions">
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            重新载入
          </button>
          <a className="btn btn-secondary" href="/">返回首页</a>
        </div>
      </main>
    )
  }
}

export function AppRoutes() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<PublicAuthRoute />} />
          <Route element={<AuthGate />}>
            <Route element={<AuthenticatedWorkspace />}>
              <Route path="/" element={<App />}>
                <Route index element={<DashboardPage />} />
                <Route path="navigation" element={<NavigationPage />} />
                {TOOL_ROUTES.map(({ id, path, Page }) => (
                  <Route key={id} path={path} element={<Page />} />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  )
}

export function RootApp() {
  return (
    <StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>
  )
}

const rootElement = document.getElementById('root')
if (rootElement) createRoot(rootElement).render(<RootApp />)
