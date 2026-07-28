import {
  AlertTriangle,
  CloudCheck,
  CloudOff,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'

import {
  useWorkspaceActions,
  useWorkspaceState,
  type WorkspaceSyncState,
} from '../contexts/WorkspaceContext'

interface SyncStatusProps {
  compact?: boolean
}

function presentation(
  status: WorkspaceSyncState,
  pendingLocalWrites: number,
  remoteWriteEnabled: boolean,
) {
  if (pendingLocalWrites > 0) {
    return {
      tone: 'info',
      label: '正在保存到本机',
      detail: '云端同步会在本机落盘完成后开始。',
      icon: <RefreshCw aria-hidden="true" size={17} />,
      retry: false,
    }
  }
  switch (status.tag) {
    case 'booting':
      return {
        tone: 'info', label: '正在载入', detail: '正在读取个人工作区。',
        icon: <RefreshCw aria-hidden="true" size={17} />, retry: false,
      }
    case 'loading':
      return {
        tone: 'info', label: status.cached ? '正在核对云端' : '正在载入',
        detail: status.cached ? '先显示本机缓存，云端结果不会静默覆盖修改。' : '正在读取个人工作区。',
        icon: <RefreshCw aria-hidden="true" size={17} />, retry: false,
      }
    case 'synced':
      return remoteWriteEnabled
        ? {
            tone: 'success', label: '已同步', detail: '本机与云端版本一致。',
            icon: <CloudCheck aria-hidden="true" size={17} />, retry: false,
          }
        : {
            tone: 'neutral', label: '云端只读 · 已加载', detail: '当前部署未启用 V2 云端写入。',
            icon: <ShieldCheck aria-hidden="true" size={17} />, retry: false,
          }
    case 'dirty':
      return {
        tone: 'warning', label: '待同步', detail: '修改已保存在本机，正在等待云端队列。',
        icon: <HardDrive aria-hidden="true" size={17} />, retry: false,
      }
    case 'writerDisabled':
      return {
        tone: 'neutral', label: '已保存到本机 · 云端只读',
        detail: 'VITE_ENABLE_NAV_V2_WRITE 未明确启用，因此不会写入 Supabase。',
        icon: <ShieldCheck aria-hidden="true" size={17} />, retry: false,
      }
    case 'syncing':
      return {
        tone: 'info', label: '同步中', detail: `正在执行第 ${status.attempt} 次安全提交。`,
        icon: <RefreshCw aria-hidden="true" size={17} />, retry: false,
      }
    case 'offline':
      return {
        tone: 'warning', label: '离线，修改已保存在本机', detail: '恢复网络后会自动重试。',
        icon: <WifiOff aria-hidden="true" size={17} />, retry: true,
      }
    case 'retryWait':
      return {
        tone: 'warning', label: '同步暂时失败', detail: '系统会退避重试，也可立即重试。',
        icon: <CloudOff aria-hidden="true" size={17} />, retry: true,
      }
    case 'failed':
      return {
        tone: 'error', label: '同步失败', detail: status.error.message,
        icon: <CloudOff aria-hidden="true" size={17} />, retry: true,
      }
    case 'conflict':
      return {
        tone: 'error', label: status.deferred ? '同步冲突 · 待处理' : '发现同步冲突',
        detail: '本机和云端都保留，选择前不会覆盖任何一方。',
        icon: <AlertTriangle aria-hidden="true" size={17} />, retry: false,
      }
    case 'fatal':
      return {
        tone: 'error', label: '本机保存失败', detail: status.error.message,
        icon: <CloudOff aria-hidden="true" size={17} />, retry: false,
      }
  }
}

export function SyncStatus({ compact = false }: SyncStatusProps) {
  const state = useWorkspaceState()
  const actions = useWorkspaceActions()
  const view = presentation(state.status, state.pendingLocalWrites, state.remoteWriteEnabled)
  const conflictDeferred = state.status.tag === 'conflict' && state.status.deferred

  return (
    <div
      className={`sync-status sync-status-${view.tone}${compact ? ' sync-status-compact' : ''}`}
      role="status"
      aria-live="polite"
      title={view.detail}
    >
      {view.icon}
      <span>{view.label}</span>
      {!compact && <small>{view.detail}</small>}
      {view.retry && state.remoteWriteEnabled && (
        <button type="button" onClick={actions.retrySync}>重试</button>
      )}
      {conflictDeferred && (
        <button type="button" onClick={actions.reopenConflict}>处理冲突</button>
      )}
    </div>
  )
}
