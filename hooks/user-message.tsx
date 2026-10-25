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
const skillPage = atom({ plugin: 'user-message-style', key: 'skillPage' } as const, 0)
const SKILL_PAGE_SIZE = 10

const fmtTokens = (n: number | undefined): string => {
  if (n === undefined) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

const bar = (percent: number | undefined, width: number): string => {
  if (percent === undefined) return ' '.repeat(width)
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const shortCategory = (name: string): string =>
  name.replace(/\s*\(deferred\)\s*$/i, '').replace(/\s+icons?$/i, '')

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

    const usage = await $.session.usage({ breakdown: 'full' })

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
    const pageIndex = Math.max(0, (await read($, skillPage)) as number) * SKILL_PAGE_SIZE

    return (
      <Box flexDirection="column" rowGap={1} paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color="claude">session status</Text>
          <Box flexDirection="row" columnGap={2}>
            <Box key="refresh-wrap">
              <Button key="refresh" label="refresh" plain hover={{ color: 'claude' }} onPress={() => update($, refreshes, (n) => n + 1)}>
                <Text dimColor> ⟳ refresh </Text>
              </Button>
            </Box>
            <Box key="close-wrap">
              <Button key="close" label="close" plain hover={{ color: 'error' }} onPress={() => $.ui.close({ id: 'ustyle' })}>
                <Text dimColor> ✕ close </Text>
              </Button>
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text dimColor>context breakdown</Text>
          {bd ? (
            <Box flexDirection="column">
              {bd.categories.slice(0, 6).map((c) => (
                <Text key={`cat-${c.kind}-${c.name}`} dimColor>
                  {`  ${shortCategory(c.name)} ${fmtTokens(c.tokens)}`}
                </Text>
              ))}
            </Box>
          ) : (
            <Text dimColor>  —</Text>
          )}
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
          <Box flexDirection="row" justifyContent="space-between">
            <Text dimColor>
              skills {skills ? `${skills.includedSkills}/${skills.totalSkills} · ${fmtTokens(skills.tokens)} tok` : '—'}
            </Text>
            {skills && skills.skillFrontmatter.length > SKILL_PAGE_SIZE ? (
              <Box flexDirection="row" columnGap={1}>
                <Box key="skill-prev-wrap">
                  <Button key="skill-prev" label="prev" plain hover={{ color: 'claude' }} onPress={() => update($, skillPage, (n) => Math.max(0, (n ?? 0) - 1))}>
                    <Text dimColor> ‹ prev </Text>
                  </Button>
                </Box>
                <Box key="skill-next-wrap">
                  <Button key="skill-next" label="next" plain hover={{ color: 'claude' }} onPress={() => update($, skillPage, (n) => Math.min(Math.ceil(skills.skillFrontmatter.length / SKILL_PAGE_SIZE) - 1, (n ?? 0) + 1))}>
                    <Text dimColor> next › </Text>
                  </Button>
                </Box>
              </Box>
            ) : null}
          </Box>
          {skills ? (
            <Box flexDirection="column">
              {skills.skillFrontmatter
                .slice(pageIndex, pageIndex + SKILL_PAGE_SIZE)
                .map((s) => (
                  <Text key={`s-${s.name}`}>
                    {`  ${s.name.padEnd(24, ' ')}`}
                    <Text dimColor>{` ${fmtTokens(s.tokens)} · ${s.source}`}</Text>
                  </Text>
                ))}
              {skills.skillFrontmatter.length > SKILL_PAGE_SIZE ? (
                <Text dimColor>{`  page ${(await read($, skillPage)) + 1}/${Math.ceil(skills.skillFrontmatter.length / SKILL_PAGE_SIZE)}`}</Text>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    )
  })

  on('session.start', async ($, _e, next) => {
    await $.command.register({
      name: 'ustyle',
      description: 'Open the session status pane',
    })
    return next(_e)
  })

  on('command.run', { command: 'ustyle' }, async ($, _e, next) => {
    await $.ui.open({ id: 'ustyle', title: 'session status', focus: true, rows: 24 })
    return { text: 'Status pane opened.' }
  })
}
