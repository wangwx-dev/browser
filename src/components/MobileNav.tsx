import { Compass, Home, Menu, Search, Wrench } from 'lucide-react'
import { NavLink } from 'react-router-dom'

interface MobileNavProps {
  onOpenSearch: () => void
  onOpenTools: () => void
  onOpenMore: () => void
}

export function MobileNav({ onOpenSearch, onOpenTools, onOpenMore }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="移动端主导航">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
        <Home aria-hidden="true" size={22} />
        <span>首页</span>
      </NavLink>
      <button type="button" onClick={onOpenSearch}>
        <Search aria-hidden="true" size={22} />
        <span>搜索</span>
      </button>
      <NavLink to="/navigation" className={({ isActive }) => (isActive ? 'active' : undefined)}>
        <Compass aria-hidden="true" size={22} />
        <span>导航</span>
      </NavLink>
      <button type="button" onClick={onOpenTools}>
        <Wrench aria-hidden="true" size={22} />
        <span>工具</span>
      </button>
      <button type="button" onClick={onOpenMore}>
        <Menu aria-hidden="true" size={22} />
        <span>更多</span>
      </button>
    </nav>
  )
}
