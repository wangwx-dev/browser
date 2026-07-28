import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Globe2,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'

import { isSafeNavigationUrl } from '../domain/nav-config'
import type { NavLinkV2, UUID } from '../types/workspace'
import './LinkCard.css'

interface CategoryOption {
  id: UUID
  name: string
}

interface LinkCardProps {
  link: NavLinkV2
  isEditing?: boolean
  isFavorite?: boolean
  isDragOverlay?: boolean
  currentCategoryId?: UUID
  categoryOptions?: readonly CategoryOption[]
  canMoveUp?: boolean
  canMoveDown?: boolean
  onOpen?: () => void
  onToggleFavorite?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveCategory?: (categoryId: UUID) => void
}

function SiteIcon({ icon }: { icon?: string }) {
  const [failed, setFailed] = useState(false)
  const mayLoad = Boolean(icon && isSafeNavigationUrl(icon))

  if (!mayLoad || failed) return <Globe2 aria-hidden="true" size={23} />
  return <img src={icon} alt="" onError={() => setFailed(true)} />
}

function siteHost(url: string): string {
  if (!isSafeNavigationUrl(url)) return '网址不可用'
  try {
    return new URL(url).hostname
  } catch {
    return '网址不可用'
  }
}

export function LinkCard({
  link,
  isEditing = false,
  isFavorite = false,
  isDragOverlay = false,
  currentCategoryId,
  categoryOptions = [],
  canMoveUp = false,
  canMoveDown = false,
  onOpen,
  onToggleFavorite,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveCategory,
}: LinkCardProps) {
  const description = link.description
  const safe = isSafeNavigationUrl(link.url)
  const interactive = Boolean(onOpen) && safe && !isEditing && !isDragOverlay

  return (
    <article className={`link-card${isEditing ? ' editing' : ''}${isDragOverlay ? ' drag-overlay' : ''}`}>
      <button
        type="button"
        className="link-card-main"
        disabled={!interactive}
        aria-label={safe ? `打开 ${link.name}` : `${link.name} 的网址不安全，无法打开`}
        title={safe ? link.url : '仅支持安全的 HTTP 或 HTTPS 地址'}
        onClick={onOpen}
      >
        <span className="link-card-icon"><SiteIcon key={link.icon ?? ''} icon={link.icon} /></span>
        <span className="link-card-info">
          <strong>{link.name}</strong>
          <span>{description || siteHost(link.url)}</span>
          {description && <small>{siteHost(link.url)}</small>}
        </span>
        {interactive && <ExternalLink className="link-card-external" aria-hidden="true" size={17} />}
      </button>

      {!isDragOverlay && onToggleFavorite && (
        <button
          type="button"
          className={`link-card-favorite${isFavorite ? ' active' : ''}`}
          aria-label={`${isFavorite ? '取消收藏' : '收藏'} ${link.name}`}
          aria-pressed={isFavorite}
          onClick={onToggleFavorite}
        >
          <Star aria-hidden="true" size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}

      {!isDragOverlay && isEditing && (
        <details className="link-card-menu">
          <summary aria-label={`管理 ${link.name}`} title={`管理 ${link.name}`}>
            <MoreVertical aria-hidden="true" size={19} />
          </summary>
          <div className="link-card-menu-popover">
            {onEdit && <button type="button" onClick={onEdit}><Pencil aria-hidden="true" size={16} />编辑</button>}
            {onMoveUp && (
              <button type="button" disabled={!canMoveUp} onClick={onMoveUp}>
                <ArrowUp aria-hidden="true" size={16} />上移
              </button>
            )}
            {onMoveDown && (
              <button type="button" disabled={!canMoveDown} onClick={onMoveDown}>
                <ArrowDown aria-hidden="true" size={16} />下移
              </button>
            )}
            {onMoveCategory && categoryOptions.length > 1 && currentCategoryId && (
              <label className="link-card-category-select">
                <span>移至分类</span>
                <select
                  aria-label={`移动 ${link.name} 到分类`}
                  value={currentCategoryId}
                  onChange={(event) => onMoveCategory(event.target.value as UUID)}
                >
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            )}
            {onDelete && (
              <button type="button" className="danger" onClick={onDelete}>
                <Trash2 aria-hidden="true" size={16} />删除
              </button>
            )}
          </div>
        </details>
      )}
    </article>
  )
}
