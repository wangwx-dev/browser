import {
  BookOpen,
  Box,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Columns2,
  Compass,
  Database,
  FileJson,
  Globe,
  Hash,
  Home,
  Image,
  LogOut,
  Repeat,
  ShieldAlert,
  TerminalSquare,
  Type,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { TOOL_REGISTRY } from '../config/tools'

const ICONS: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  box: Box,
  clock: Clock,
  'code-2': Code2,
  'columns-2': Columns2,
  database: Database,
  'file-json': FileJson,
  globe: Globe,
  hash: Hash,
  image: Image,
  repeat: Repeat,
  'shield-alert': ShieldAlert,
  type: Type,
}

interface SidebarProps {
  collapsed?: boolean
  mobileOpen?: boolean
  userEmail?: string
  onCloseMobile?: () => void
  onToggleCollapsed?: () => void
  onSignOut?: () => void | Promise<void>
}

export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  userEmail,
  onCloseMobile,
  onToggleCollapsed,
  onSignOut,
}: SidebarProps) {
  const groups = Array.from(new Set(TOOL_REGISTRY.map((tool) => tool.category)))
  const closeAfterNavigation = () => onCloseMobile?.()

  return (
    <>
      <button
        type="button"
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        aria-label="关闭导航菜单"
        onClick={onCloseMobile}
      />
      <aside id="workspace-sidebar" className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <TerminalSquare aria-hidden="true" size={24} />
          <span className="sidebar-label">Dev Workbench</span>
          <button
            type="button"
            className="sidebar-mobile-close"
            aria-label="关闭导航菜单"
            onClick={onCloseMobile}
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="工作台主导航">
          <div className="sidebar-primary-links">
            <NavLink
              to="/"
              end
              title={collapsed ? '首页' : undefined}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeAfterNavigation}
            >
              <Home aria-hidden="true" size={19} />
              <span className="sidebar-label">首页</span>
            </NavLink>
            <NavLink
              to="/navigation"
              title={collapsed ? '我的导航' : undefined}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeAfterNavigation}
            >
              <Compass aria-hidden="true" size={19} />
              <span className="sidebar-label">我的导航</span>
            </NavLink>
          </div>

          <div className="sidebar-tools-scroll">
            {groups.map((group) => (
              <div key={group} className="sidebar-group">
                <div className="sidebar-group-title">{group}</div>
                {TOOL_REGISTRY.filter((tool) => tool.category === group).map((tool) => {
                  const Icon = ICONS[tool.iconKey] ?? TerminalSquare
                  return (
                    <NavLink
                      key={tool.id}
                      to={tool.path}
                      title={collapsed ? tool.title : undefined}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                      onClick={closeAfterNavigation}
                    >
                      <Icon aria-hidden="true" size={19} />
                      <span className="sidebar-label">{tool.title}</span>
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account" title={userEmail}>
            <UserRound aria-hidden="true" size={19} />
            <span className="sidebar-label">{userEmail || '个人工作台'}</span>
          </div>
          <button type="button" className="nav-item sidebar-signout" onClick={onSignOut}>
            <LogOut aria-hidden="true" size={19} />
            <span className="sidebar-label">退出登录</span>
          </button>
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <ChevronRight aria-hidden="true" size={19} />
            ) : (
              <ChevronLeft aria-hidden="true" size={19} />
            )}
            <span className="sidebar-label">折叠侧栏</span>
          </button>
        </div>
      </aside>
    </>
  )
}
