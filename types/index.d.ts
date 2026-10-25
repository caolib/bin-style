/**
 * The values this mod keeps in `$.state` (the session's): read with
 * `read($, atom)` while drawing, written from handlers.
 */

declare module 'claude-code' {
  export interface PluginState {
    'user-message-style': {
      /** The swatch last picked in the /ustyle demo pane. */
      picked: string
      /** How many times the pane's refresh button was pressed. */
      pressed: number
      /** How many times the status pane's refresh button was pressed. */
      refreshes: number
    }
  }
}
