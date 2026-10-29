import type { ModelUsage, SessionContextUsage } from 'claude-code'
import type { GitStatus, ResponseStats } from '../types'

export const tokens = (value: number | null | undefined): string =>
  value == null || !Number.isFinite(value) ? '—' : `${(value / 1000).toFixed(1)}k`

export const basename = (path: string): string =>
  path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path

export const cachePercent = (usage: ModelUsage): number | null => {
  const total = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  return total > 0 ? Math.min(100, Math.max(0, usage.cache_read_input_tokens / total * 100)) : null
}

export const diffCounts = (text: string): { added: number; removed: number } => {
  let added = 0
  let removed = 0
  for (const row of text.split('\n')) {
    const [plus, minus] = row.split('\t')
    if (plus && minus && /^\d+$/.test(plus) && /^\d+$/.test(minus)) {
      added += Number(plus)
      removed += Number(minus)
    }
  }
  return { added, removed }
}

export const statusSegments = (
  model: string,
  effort: string | null,
  context: SessionContextUsage,
  response: ResponseStats | null,
  git: GitStatus | null,
  cwd: string,
): string[] => {
  const percentage = context.percent ?? (context.tokens !== undefined && context.window > 0
    ? context.tokens / context.window * 100 : undefined)
  const used = percentage === undefined ? '—' : `${Math.max(0, Math.min(100, percentage)).toFixed(1)}%`
  const cache = context.tokens !== undefined && response?.cacheHit != null
    ? `${response.cacheHit.toFixed(1)}%` : '—'
  const repo = git?.cwd === cwd ? git : null
  const changes = repo?.added != null && repo.removed != null
    ? `(+${repo.added},-${repo.removed})` : '(—)'
  const track = repo?.ahead != null && repo.behind != null && (repo.ahead > 0 || repo.behind > 0)
    ? ` ${repo.ahead > 0 ? `↑${repo.ahead}` : ''}${repo.behind > 0 ? `↓${repo.behind}` : ''}` : ''
  return [
    `${model.split('/').filter(Boolean).pop() || model}${effort ? `(${effort})` : ''}`,
    `${used} / ${tokens(context.window)}`,
    `${tokens(context.tokens)} (${cache})`,
    repo?.directory ?? basename(cwd),
    repo?.branch ? `${repo.branch}${track} ${changes}` : 'git: —',
  ]
}

export const statusText = (...args: Parameters<typeof statusSegments>): string =>
  statusSegments(...args).join('  ·  ')

