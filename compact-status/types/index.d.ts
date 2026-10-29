export type GitStatus = {
  cwd: string
  directory: string
  branch: string | null
  added: number | null
  removed: number | null
  ahead: number | null
  behind: number | null
}

export type ResponseStats = {
  model: string
  effort: string | null
  cacheHit: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'compact-status': {
      git: GitStatus | null
      response: ResponseStats | null
      revision: number
    }
  }
}
