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
 * `/ustyle` opens a demo Pane (docked beside the transcript in fullscreen
 * from 110 columns): theme-color swatches, a press counter, hints.
 */

type ThemeColor = 'claude' | 'warning' | 'success' | 'error' | 'permission'

const picked = atom({ plugin: 'user-message-style', key: 'picked' } as const, 'claude')
const pressed = atom({ plugin: 'user-message-style', key: 'pressed' } as const, 0)

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

  // The demo pane: opened by /ustyle, drawn for id "ustyle".
  on('ui.render', { component: 'Pane', requestId: 'ustyle' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const current = await read($, picked)
    const count = await read($, pressed)
    const colors: ThemeColor[] = ['claude', 'warning', 'success', 'error', 'permission']

    return (
      <Box flexDirection="column" rowGap={1} paddingX={1}>
        <Text bold color="claude">user-message-style</Text>

        <Box flexDirection="column" rowGap={0}>
          <Text dimColor>Pick a swatch (pane demo only; the transcript border reads /config):</Text>
          <Box flexDirection="row" columnGap={1}>
            {colors.map((c, i) => (
              <Button key={`c-${c}`} label={c} hotkey={String(i + 1)} onPress={() => update($, picked, () => c)}>
                {current === c ? <Text color={c} bold>{`● ${c}`}</Text> : <Text color={c}>{`○ ${c}`}</Text>}
              </Button>
            ))}
          </Box>
        </Box>

        <Button key="tick" label="refresh" onPress={() => update($, pressed, (n) => n + 1)}>
          <Text dimColor>{`⟳ pressed ${count}x`}</Text>
        </Button>

        <Box flexDirection="column">
          <Text dimColor>1-5 pick a swatch · ctrl+x tab focus · Esc close</Text>
        </Box>
      </Box>
    )
  })

  on('session.start', async ($) => {
    await $.command.register({
      name: 'ustyle',
      description: 'Open the user-message-style demo pane',
    })
  })

  on('command.run', { command: 'ustyle' }, async ($, e, next) => {
    await $.ui.open({ id: 'ustyle', title: 'user-message-style', focus: true, rows: 12 })
    return { text: 'Pane opened (docked beside the transcript while it fits).' }
  })
}
