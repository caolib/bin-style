import type { Register } from 'claude-code'

/**
 * Restyles the person's own transcript rows (`> ...`) so they stand out in
 * dark themes: the message body drawn inside a colored rounded border.
 *
 * Only rows the person truly typed (`origin.kind === 'composer'`, plus
 * `bridge` — a phone/web client) are highlighted; notifications and other
 * agents' messages keep the engine's own drawing.
 */

type ThemeColor = 'claude' | 'warning' | 'success' | 'error' | 'permission'

const OWN_KINDS = new Set(['composer', 'bridge'])

export const register: Register = (on, options) => {
  const color = (options.color as ThemeColor | undefined) ?? 'claude'

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (!OWN_KINDS.has(e.props.origin.kind)) {
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
