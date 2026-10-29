import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'
import type { GitStatus, ResponseStats } from '../types'
import { basename, cachePercent, diffCounts, statusSegments, tokens } from './format'

const git = atom({ plugin: 'compact-status', key: 'git' } as const, null)
const response = atom({ plugin: 'compact-status', key: 'response' } as const, null)
const revision = atom({ plugin: 'compact-status', key: 'revision' } as const, 0)

const emptyResponse = (model: string, effort: string | null): ResponseStats => ({
  model, effort, cacheHit: null,
})

const configuredEffort = async ($: EngineInterface): Promise<string | null> => {
  const env = await $.env.get('CLAUDE_EFFORT')
  const setting = env || await $.settings.read({ key: 'effortLevel' })
  return typeof setting === 'string' || typeof setting === 'number' ? String(setting) : null
}

let refreshing = false

const runGit = ($: EngineInterface, cwd: string, args: string[]) => $.process.run(
  ['git', '--no-optional-locks', '-C', cwd, ...args],
  { cwd, timeoutMs: 2000, env: { GIT_OPTIONAL_LOCKS: '0' } },
)

const refreshGit = async ($: EngineInterface) => {
  if (refreshing) return
  refreshing = true
  try {
    const cwd = await $.session.cwd()
    let value: GitStatus = {
      cwd, directory: basename(cwd), branch: null, added: null, removed: null, ahead: null, behind: null,
    }
    try {
      const root = await runGit($, cwd, ['rev-parse', '--show-toplevel'])
      if (root.exitCode === 0 && !root.isStdoutTruncated) {
        const [branch, working, staged, tracking] = await Promise.all([
          runGit($, cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
          runGit($, cwd, ['diff', '--no-ext-diff', '--no-textconv', '--numstat', '--']),
          runGit($, cwd, ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--numstat', '--']),
          runGit($, cwd, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']),
        ])
        let name = branch.exitCode === 0 ? branch.stdout.trim() : null
        if (!name) {
          const head = await runGit($, cwd, ['rev-parse', '--short', 'HEAD'])
          if (head.exitCode === 0) name = `@${head.stdout.trim()}`
        }
        value = { ...value, directory: basename(root.stdout.trim()), branch: name }
        if (working.exitCode === 0 && staged.exitCode === 0
            && !working.isStdoutTruncated && !staged.isStdoutTruncated) {
          const a = diffCounts(working.stdout)
          const b = diffCounts(staged.stdout)
          value.added = a.added + b.added
          value.removed = a.removed + b.removed
        }
        // No upstream leaves both null: ahead/behind have no meaning there.
        if (tracking.exitCode === 0 && !tracking.isStdoutTruncated) {
          const [behind, ahead] = tracking.stdout.trim().split(/\s+/).map(Number)
          if (behind !== undefined && ahead !== undefined
              && Number.isFinite(behind) && Number.isFinite(ahead)) {
            value = { ...value, ahead, behind }
          }
        }
      }
    } catch {
      // A missing Git executable or denied read leaves honest placeholders.
    }
    if (await $.session.cwd() !== cwd) return
    if (JSON.stringify(await read($, git)) !== JSON.stringify(value)) {
      await update($, git, () => value)
    }
  } finally {
    refreshing = false
  }
}

const color = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback

type Palette = {
  /** The five segment backgrounds, or null for a theme that paints only foreground colours. */
  backgrounds: [string, string, string, string, string] | null
  /** Per-segment text colours, used instead of backgrounds. */
  accents: [string, string, string, string, string]
  /** The base text colour of a background theme, and the neutral text of a plain one. */
  foreground: string
  gitForeground: string
  added: string
  removed: string
  /** The cache hit rate reads green at 90% and up, red below; both clear 4.5:1 on their surface. */
  hitGood: string
  hitBad: string
}

const DARK_HIT_GOOD = '#0b5d1e'
const DARK_HIT_BAD = '#8f1d2c'

/** Every text/background pair clears WCAG 4.5:1. A colour option overrides its slot. */
const THEMES: Record<string, Palette> = {
  default: {
    foreground: '#0b0b0b',
    accents: ['#7fb0e8', '#7ecfa6', '#f0a070', '#e9c46a', '#f0efec'],
    backgrounds: ['#7fb0e8', '#7ecfa6', '#f0a070', '#e9c46a', '#282828'],
    gitForeground: '#f0efec', added: '#7ecfa6', removed: '#f28b82',
    hitGood: DARK_HIT_GOOD, hitBad: DARK_HIT_BAD,
  },
  onedark: {
    foreground: '#21252b',
    accents: ['#61afef', '#98c379', '#e5c07b', '#e06c75', '#abb2bf'],
    backgrounds: ['#61afef', '#98c379', '#e5c07b', '#e06c75', '#282c34'],
    gitForeground: '#abb2bf', added: '#98c379', removed: '#ff8b92',
    hitGood: DARK_HIT_GOOD, hitBad: DARK_HIT_BAD,
  },
  'tokyo-night': {
    foreground: '#16161e',
    accents: ['#7aa2f7', '#9ece6a', '#ff9e64', '#e0af68', '#c0caf5'],
    backgrounds: ['#7aa2f7', '#9ece6a', '#ff9e64', '#e0af68', '#1f2335'],
    gitForeground: '#c0caf5', added: '#9ece6a', removed: '#f7768e',
    hitGood: DARK_HIT_GOOD, hitBad: DARK_HIT_BAD,
  },
  gruvbox: {
    foreground: '#1d2021',
    accents: ['#83a598', '#b8bb26', '#fe8019', '#fabd2f', '#ebdbb2'],
    backgrounds: ['#83a598', '#b8bb26', '#fe8019', '#fabd2f', '#282828'],
    gitForeground: '#ebdbb2', added: '#b8bb26', removed: '#fb8a76',
    hitGood: DARK_HIT_GOOD, hitBad: DARK_HIT_BAD,
  },
  nord: {
    foreground: '#262a33',
    accents: ['#88c0d0', '#a3be8c', '#d08770', '#ebcb8b', '#eceff4'],
    backgrounds: ['#88c0d0', '#a3be8c', '#d08770', '#ebcb8b', '#2e3440'],
    gitForeground: '#eceff4', added: '#a3be8c', removed: '#e08c96',
    hitGood: DARK_HIT_GOOD, hitBad: DARK_HIT_BAD,
  },
  catppuccin: {
    foreground: '#1e1e2e',
    accents: ['#89b4fa', '#a6e3a1', '#fab387', '#f9e2af', '#cdd6f4'],
    backgrounds: ['#89b4fa', '#a6e3a1', '#fab387', '#f9e2af', '#1e1e2e'],
    gitForeground: '#cdd6f4', added: '#a6e3a1', removed: '#f38ba8',
    hitGood: DARK_HIT_GOOD, hitBad: DARK_HIT_BAD,
  },
  mono: {
    foreground: '#0b0b0b',
    accents: ['#b8b8b8', '#c4c4c4', '#d6d6d6', '#e4e4e4', '#f0efec'],
    backgrounds: ['#b8b8b8', '#c4c4c4', '#d6d6d6', '#e4e4e4', '#282828'],
    gitForeground: '#f0efec', added: '#9ad6a8', removed: '#f0a0a0',
    hitGood: DARK_HIT_GOOD, hitBad: DARK_HIT_BAD,
  },
  plain: {
    foreground: '#c8c8c8',
    accents: ['#7fb0e8', '#7ecfa6', '#f0a070', '#e9c46a', '#c8c8c8'],
    backgrounds: null,
    gitForeground: '#c8c8c8', added: '#7ecfa6', removed: '#f28b82',
    hitGood: '#7ecfa6', hitBad: '#f28b82',
  },
}

const PREVIEW_PANE = 'status-theme'

/**
 * Powerline caps: a rounded left edge, a rounded half circle between parts, a rounded right edge.
 * The separating half circle paints the next part's colour over the previous part's background,
 * so each part begins with a rounded edge instead of ending flat.
 */

const CAP_LEFT = ''
const CAP_ARROW = ''
const CAP_RIGHT = ''

export const register: Register = (on, options) => {
  const theme = THEMES[String(options.theme ?? '')] ?? THEMES.default!
  const foreground = theme.foreground
  const gitForeground = theme.gitForeground
  const addedColor = theme.added
  const removedColor = theme.removed
  const backgrounds = (theme.backgrounds ?? theme.accents) as [string, string, string, string, string]
  const plain = theme.backgrounds === null
  let timer: Timer | undefined
  let generation = 0

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'status-theme',
        description: '预览状态栏的全部配色主题',
      })
    } catch {
      // A host that refuses the command still gets the band.
    }
    const result = await next(e)
    const [model, effort] = await Promise.all([$.session.model(), configuredEffort($)])
    if (await read($, response) === null) {
      const initial = emptyResponse(model, effort)
      // Local estimate only: apiUsage itself is the last actual response's usage.
      const usage = await $.session.usage({ breakdown: 'summary' })
      if (usage.context.breakdown?.apiUsage) initial.cacheHit = cachePercent(usage.context.breakdown.apiUsage)
      await update($, response, () => initial)
    }
    await refreshGit($)
    timer?.cancel()
    timer = $.clock.every(5000, () => { void refreshGit($).catch(() => {}) })
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (e.context.tokens === undefined) {
      await update($, response, old => old ? { ...old, cacheHit: null } : null)
    }
    await update($, revision, n => n + 1)
    return result
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    const epoch = generation
    const effort = e.effort === undefined ? null : String(e.effort)
    await update($, response, old => ({ ...(old ?? emptyResponse(e.model, effort)), model: e.model, effort }))
    const result = yield* next(e)
    if (epoch === generation && result.usage) {
      const usage = result.usage
      await update($, response, () => ({
        model: e.model,
        effort,
        cacheHit: cachePercent(usage),
      }))
    }
    return result
  })

  on('command.run', { command: 'status-theme' }, async $ => {
    await $.ui.open({ id: PREVIEW_PANE, title: '状态栏配色' })
    return { text: '配色预览已打开：在 /config 的「配色主题」里选择，选中即生效。' }
  })

  on('command.run', async ($, e, next) => {
    const result = await next(e)
    if (e.command === 'clear' || e.command === 'resume') {
      generation += 1
      await update($, response, () => null)
    }
    await update($, revision, n => n + 1)
    void refreshGit($).catch(() => {})
    return result
  })

  on('session.end', async ($, e, next) => {
    generation += 1
    if (e.reason === 'clear' || e.reason === 'resume') {
      await update($, response, () => null)
    } else {
      timer?.cancel()
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PREVIEW_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    // Each row is the real band, drawn with sample figures in that theme's colours.
    const sample = (palette: Palette) => {
      if (palette.backgrounds === null) {
        return (
          <Box flexDirection="row">
            <Text color={palette.accents[0]}> gpt-6-astra(xhigh) </Text>
            <Text dimColor>·</Text>
            <Text color={palette.accents[1]}> 8.0% / 922.0k </Text>
            <Text dimColor>·</Text>
            <Text color={palette.gitForeground}> 77.0k (</Text>
            <Text color={palette.hitGood}>96.8%</Text>
            <Text color={palette.gitForeground}>) </Text>
            <Text dimColor>·</Text>
            <Text color={palette.accents[3]}> bin-style </Text>
            <Text dimColor>·</Text>
            <Text color={palette.gitForeground}> main (</Text>
            <Text color={palette.added}>+123</Text>
            <Text color={palette.gitForeground}>,</Text>
            <Text color={palette.removed}>-456</Text>
            <Text color={palette.gitForeground}>) </Text>
          </Box>
        )
      }
      const bg = palette.backgrounds
      return (
        <Box flexDirection="row">
          <Box flexShrink={0}>
            <Text color={bg[0]}>{CAP_LEFT}</Text>
          </Box>
          <Box backgroundColor={bg[0]} flexShrink={0}>
            <Text color={palette.foreground}> gpt-6-astra(xhigh) </Text>
          </Box>
          <Box backgroundColor={bg[0]} flexShrink={0}>
            <Text color={bg[1]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={bg[1]} flexShrink={0}>
            <Text color={palette.foreground}> 8.0% / 922.0k </Text>
          </Box>
          <Box backgroundColor={bg[1]} flexShrink={0}>
            <Text color={bg[2]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={bg[2]} flexShrink={0}>
            <Text color={palette.foreground}> 77.0k (</Text>
          </Box>
          <Box backgroundColor={bg[2]} flexShrink={0}>
            <Text color={palette.foreground}>96.8%</Text>
          </Box>
          <Box backgroundColor={bg[2]} flexShrink={0}>
            <Text color={palette.foreground}>) </Text>
          </Box>
          <Box backgroundColor={bg[2]} flexShrink={0}>
            <Text color={bg[3]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={bg[3]} flexShrink={0}>
            <Text color={palette.foreground}> bin-style </Text>
          </Box>
          <Box backgroundColor={bg[3]} flexShrink={0}>
            <Text color={bg[4]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={bg[4]} flexShrink={0}>
            <Text color={palette.gitForeground}> main (</Text>
          </Box>
          <Box backgroundColor={bg[4]} flexShrink={0}>
            <Text color={palette.added}>+123</Text>
          </Box>
          <Box backgroundColor={bg[4]} flexShrink={0}>
            <Text color={palette.gitForeground}>,</Text>
          </Box>
          <Box backgroundColor={bg[4]} flexShrink={0}>
            <Text color={palette.removed}>-456</Text>
          </Box>
          <Box backgroundColor={bg[4]} flexShrink={0}>
            <Text color={palette.gitForeground}>) </Text>
          </Box>
          <Box flexShrink={0}>
            <Text color={bg[4]}>{CAP_RIGHT}</Text>
          </Box>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Text dimColor>在 /config 的「配色主题」里选择，选中即生效。</Text>
        <Text> </Text>
        {Object.entries(THEMES).map(([name, palette]) => (
          <Box flexDirection="column">
            <Text dimColor>{name}</Text>
            {sample(palette)}
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    await read($, revision)
    const [stats, repository, usage, model, cwd, fallbackEffort] = await Promise.all([
      read($, response), read($, git), $.session.usage(),
      $.session.model(), $.session.cwd(), configuredEffort($),
    ])
    const effort = stats?.model === model ? stats.effort : fallbackEffort
    const segments = statusSegments(model, effort, usage.context, stats, repository, cwd)
    const hit = usage.context.tokens !== undefined && stats?.cacheHit != null ? stats.cacheHit : null
    const hitText = hit === null ? '—' : `${hit.toFixed(1)}%`
    // Only the plain theme colours the rate: on painted cells it reads better as plain text.
    const hitColor = !plain
      ? foreground
      : hit === null ? gitForeground : hit >= 90 ? theme.hitGood : theme.hitBad
    const total = tokens(usage.context.tokens)
    const repo = repository?.cwd === cwd ? repository : null
    const hasChanges = Boolean(repo?.branch) && repo?.added != null && repo?.removed != null
    const gitText = hasChanges
      ? <Text>
          {repo!.branch}(<Text color={addedColor}>+{repo!.added}</Text>,<Text color={removedColor}>-{repo!.removed}</Text>)
        </Text>
      : <Text>{segments[4]}</Text>
    const width = Math.max(1, e.props.bodyColumns)
    if (plain) {
      // A plain theme: one colour per part, a dim dot between them, no painted cells.
      return (
        <Box width={width} height={1} minHeight={1}
          flexGrow={0} flexShrink={0} margin={0} padding={0} overflow="hidden">
          <Box flexDirection="row" height={1} flexShrink={0} overflow="hidden">
            <Text color={theme.accents[0]}> {segments[0]} </Text>
            <Text dimColor>·</Text>
            <Text color={theme.accents[1]}> {segments[1]} </Text>
            <Text dimColor>·</Text>
            <Text color={gitForeground}> {total} (</Text>
            <Text color={hitColor}>{hitText}</Text>
            <Text color={gitForeground}>) </Text>
            <Text dimColor>·</Text>
            <Text color={theme.accents[3]}> {segments[3]} </Text>
            <Text dimColor>·</Text>
            <Text color={gitForeground}> {gitText} </Text>
          </Box>
        </Box>
      )
    }
    return (
      <Box width={width} height={1} minHeight={1}
        flexGrow={0} flexShrink={0} margin={0} padding={0} overflow="hidden">
        <Box flexDirection="row" height={1} flexShrink={0} overflow="hidden">
          <Box flexShrink={0}>
            <Text color={backgrounds[0]}>{CAP_LEFT}</Text>
          </Box>
          <Box backgroundColor={backgrounds[0]} flexShrink={0}>
            <Text color={foreground}> {segments[0]} </Text>
          </Box>
          <Box backgroundColor={backgrounds[0]} flexShrink={0}>
            <Text color={backgrounds[1]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={backgrounds[1]} flexShrink={0}>
            <Text color={foreground}> {segments[1]} </Text>
          </Box>
          <Box backgroundColor={backgrounds[1]} flexShrink={0}>
            <Text color={backgrounds[2]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={backgrounds[2]} flexShrink={0}>
            <Text color={foreground}> {total} (</Text>
          </Box>
          <Box backgroundColor={backgrounds[2]} flexShrink={0}>
            <Text color={hitColor}>{hitText}</Text>
          </Box>
          <Box backgroundColor={backgrounds[2]} flexShrink={0}>
            <Text color={foreground}>) </Text>
          </Box>
          <Box backgroundColor={backgrounds[2]} flexShrink={0}>
            <Text color={backgrounds[3]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={backgrounds[3]} flexShrink={0}>
            <Text color={foreground}> {segments[3]} </Text>
          </Box>
          <Box backgroundColor={backgrounds[3]} flexShrink={0}>
            <Text color={backgrounds[4]}>{CAP_ARROW}</Text>
          </Box>
          <Box backgroundColor={backgrounds[4]} flexShrink={0}>
            <Text color={gitForeground}> {gitText} </Text>
          </Box>
          <Box flexShrink={0}>
            <Text color={backgrounds[4]}>{CAP_RIGHT}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
