export const OPEN_COMMAND_PALETTE_EVENT = 'workspace:open-command-palette'

export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
}
