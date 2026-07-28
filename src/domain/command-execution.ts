import type { SearchCommand } from './search'
import type { ResourceRefV2, SafeHttpUrl } from '../types/workspace'

export type WindowOpener = (url?: string | URL, target?: string, features?: string) => Window | null
export type InternalNavigator = (path: string) => void | Promise<void>
export type RecentRecorder = (ref: ResourceRefV2) => boolean | void | Promise<boolean | void>

export interface CommandExecutionPorts {
  navigate: InternalNavigator
  recordRecent: RecentRecorder
  openSite?: (url: SafeHttpUrl) => boolean
}

function closePartialPopup(opened: Window): void {
  try {
    opened.close()
  } catch {
    // A cross-origin or already-destroyed popup may reject close; execution still failed safely.
  }
}

export function openExternalSite(
  url: SafeHttpUrl,
  opener: WindowOpener = window.open.bind(window),
): boolean {
  let opened: Window | null
  try {
    opened = opener('about:blank', '_blank', 'noopener,noreferrer')
  } catch {
    return false
  }
  if (!opened) return false
  try {
    if (opened.closed) return false
    opened.opener = null
    opened.location.replace(url)
    return true
  } catch {
    closePartialPopup(opened)
    return false
  }
}

export async function openInternalTool(path: string, navigate: InternalNavigator): Promise<boolean> {
  if (!/^\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) return false
  try {
    await navigate(path)
    return true
  } catch {
    return false
  }
}

export async function executeCommand(
  command: SearchCommand,
  ports: CommandExecutionPorts,
): Promise<boolean> {
  const succeeded =
    command.action.type === 'open-tool'
      ? await openInternalTool(command.action.path, ports.navigate)
      : (ports.openSite ?? openExternalSite)(command.action.url)
  if (!succeeded) return false

  try {
    await ports.recordRecent(command.ref)
  } catch {
    // Opening already succeeded. Workspace state exposes its own persistence failure to the user.
  }
  return true
}
