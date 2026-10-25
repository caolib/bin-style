import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

/**
 * Restyles the person's own transcript rows (`> ...`) so they stand out in
 * dark themes: the message body drawn inside a colored rounded border.
 *
 * A row is the person's own when it carries no `from` (another agent,
 * teammate, session or channel sent it) and no `task` (a background task's
 * notification) — slash commands arrive unstamped (`unclassified`) and so
 * stay covered.
 *
 * Known engine boundary (verified with a render probe): a slash command's
 * final echo row (`> /cmd args`) and the fullscreen sticky row are drawn by
 * the engine itself, never raised through ui.render — no hook sees them.
 *
 * `/ustyle` opens a status Pane (docked beside the transcript in fullscreen
 * from 110 columns): session info, context usage with a bar, and the
 * skills / MCP tools / agents the context carries, each with its tokens.
 */

type ThemeColor = 'claude' | 'warning' | 'success' | 'error' | 'permission'

const refreshes = atom({ plugin: 'user-message-style', key: 'refreshes' } as const, 0)

const fmtTokens = (n: number | undefined): string => {
  if (n === undefined) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

const bar = (percent: number | undefined, width: number): string => {
  if (percent === undefined) return ' '.repeat(width)
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export const register: Register = (on, options) => {
  const color = (options.color as ThemeColor | undefined) ?? 'claude'

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (e.props.from !== undefined || e.props.task !== undefined) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box borderStyle="round" borderColor={color} marginTop={1} paddingX={1}>
        <Text wrap="wrap">{e.props.text}</Text>
      </Box>
    )
  })

  // The status pane: opened by /ustyle, drawn for id "ustyle".
  on('ui.render', { component: 'Pane', requestId: 'ustyle' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const columns = Math.max(20, e.props.bodyColumns - 2)

    const [usage, model, version, turns] = await Promise.all([
      $.session.usage({ breakdown: 'full' }),
      $.session.model(),
      $.session.version(),
      $.session.turns(),
    ])

    const started = new Date(usage.startedAt)
    const hh = String(started.getHours()).padStart(2, '0')
    const mm = String(started.getMinutes()).padStart(2, '0')

    const bd = usage.context.breakdown
    const skills = bd?.skills
    const mcpByServer = new Map<string, { count: number; tokens: number }>()
    for (const t of bd?.mcpTools ?? []) {
      const row = mcpByServer.get(t.serverName) ?? { count: 0, tokens: 0 }
      row.count += 1
      row.tokens += t.tokens
      mcpByServer.set(t.serverName, row)
    }
    const agents = bd?.agents ?? []

    return (
      <Box flexDirection="column" rowGap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color="claude">session status</Text>
          <Text dimColor>{`refreshed ${await read($, refreshes)}x`}</Text>
        </Box>

        <Box flexDirection="column">
          <Text>{`model    ${model}`}</Text>
          <Text>{`engine   v${version.version}`}</Text>
          <Text>{`started  ${hh}:${mm} · ${turns} prompts`}</Text>
        </Box>

        <Box flexDirection="column">
          <Text dimColor>
            skills {skills ? `${skills.includedSkills}/${skills.totalSkills} · ${fmtTokens(skills.tokens)} tok` : '—'}
          </Text>
          {(skills?.skillFrontmatter ?? []).map((s) => (
            <Text key={`s-${s.name}`}>
              {`  ${s.name.padEnd(24, ' ')}`}
              <Text dimColor>{` ${fmtTokens(s.tokens)} · ${s.source}`}</Text>
            </Text>
          ))}
        </Box>

        <Box flexDirection="column">
          <Text dimColor>context breakdown</Text>
          {bd ? (
            <Box flexDirection="column">
              {bd.categories.slice(0, 6).map((c) => (
                <Text key={`cat-${c.name}`} dimColor>
                  {`  ${c.name.slice(0, 12).padEnd(12, ' ')} ${fmtTokens(c.tokens)}`}
                </Text>
              ))}
            </Box>
          ) : (
            <Text dimColor>  —</Text>
          )}
        </Box>

        <Box flexDirection="column">
          <Text dimColor>mcp servers</Text>
          {mcpByServer.size === 0 ? <Text dimColor>  none connected</Text> : null}
          {[...mcpByServer.entries()].map(([server, row]) => (
            <Text key={`m-${server}`}>
              {`  ${server.padEnd(24, ' ')}`}
              <Text dimColor>{` ${row.count} tools · ${fmtTokens(row.tokens)} tok`}</Text>
            </Text>
          ))}
        </Box>

        <Box flexDirection="column">
          <Text dimColor>{`custom agents ${agents.length}`}</Text>
          {agents.slice(0, 8).map((a) => (
            <Text key={`a-${a.agentType}`}>
              {`  ${a.agentType.padEnd(24, ' ')}`}
              <Text dimColor>{` ${fmtTokens(a.tokens)} · ${a.source}`}</Text>
            </Text>
          ))}
        </Box>

        <Button key="refresh" label="refresh" onPress={() => update($, refreshes, (n) => n + 1)}>
          <Text color="claude">⟳ refresh (r)</Text>
        </Button>
      </Box>
    )
  })

  on('session.start', async ($) => {
    await $.command.register({
      name: 'ustyle',
      description: 'Open the session status pane',
    })
  })

  on('command.run', { command: 'ustyle' }, async ($, _e, next) => {
    await $.ui.open({ id: 'ustyle', title: 'session status', focus: true, rows: 24 })
    return { text: 'Status pane opened.' }
  })
}
