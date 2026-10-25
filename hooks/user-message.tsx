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
 */

type ThemeColor = 'claude' | 'warning' | 'success' | 'error' | 'permission'

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
}
