import { Menu, Search, WifiOff } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { TOOL_REGISTRY } from '../config/tools'
import { openCommandPalette } from '../domain/command-palette'

interface AppHeaderProps {
  onToggleNavigation: () => void
  syncLabel?: string
  syncTone?: 'neutral' | 'success' | 'warning' | 'danger'
}

function titleForPath(pathname: string): string {
  if (pathname === '/') return '首页'
  if (pathname === '/navigation') return '我的导航'
  const tool = TOOL_REGISTRY.find((definition) => definition.path === pathname)
  return tool?.title ?? '开发工作台'
}

export function AppHeader({
  onToggleNavigation,
  syncLabel = '本地草稿',
  syncTone = 'neutral',
}: AppHeaderProps) {
  const location = useLocation()

  return (
    <header className="app-header">
      <button
        type="button"
        className="app-header-menu"
        aria-label="打开导航菜单"
        onClick={onToggleNavigation}
      >
        <Menu aria-hidden="true" size={22} />
      </button>
      <p className="app-header-title">{titleForPath(location.pathname)}</p>
      <button
        type="button"
        className="command-trigger"
        aria-label="搜索网站、工具或命令"
        aria-haspopup="dialog"
        onClick={openCommandPalette}
      >
        <Search aria-hidden="true" size={18} />
        <span>搜索网站、工具或命令</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div
        className={`sync-trigger sync-${syncTone}`}
        role="status"
        aria-label={`同步状态：${syncLabel}`}
      >
        <WifiOff aria-hidden="true" size={17} />
        <span>{syncLabel}</span>
      </div>
    </header>
  )
}
