import { test, expect, describe } from 'claude-code/testing'

const OWN: Array<{ kind: string; label: string }> = [
  { kind: 'composer', label: 'typed at the prompt' },
  { kind: 'bridge', label: 'sent from a phone/web client' },
  { kind: 'unclassified', label: 'a slash command, unstamped' },
]

const OTHER: Array<{ origin: Record<string, unknown>; label: string }> = []

for (const surface of ['terminal', 'desktop'] as const) {
  describe(`user-message-style on ${surface}`, () => {
    for (const { kind, label } of OWN) {
      test(`highlights a row the person sent (${label})`, async ($) => {
        const ui = await $.ui.mount({
          plugin: 'user-message-style',
          surface,
          component: 'UserMessage',
          props: {
            text: 'fix the login bug',
            origin: { kind },
            isExpanded: true,
          },
        })

        const drawn = await ui.drawn()
        expect(drawn).toMatchObject({
          type: 'Box',
          props: { borderStyle: 'round' },
        })
      })
    }

    for (const { origin, label } of OTHER) {
      test(`passes ${label} rows through untouched`, async ($, on) => {
        // Stand for the engine's own drawing: nothing beneath the plugins.
        on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))

        const ui = await $.ui.mount({
          plugin: 'user-message-style',
          surface,
          component: 'UserMessage',
          props: {
            text: 'a notification arrives',
            origin,
            isExpanded: true,
          },
        })

        const drawn = await ui.drawn()
        expect(drawn).toMatchObject({ type: 'engine', ref: 0 })
      })
    }

    test('passes rows carrying `from` (another sender) through untouched', async ($, on) => {
      on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))

      const ui = await $.ui.mount({
        plugin: 'user-message-style',
        surface,
        component: 'UserMessage',
        props: {
          text: 'a teammate writes',
          origin: { kind: 'unclassified' },
          isExpanded: true,
          from: { kind: 'teammate', name: 'alex' },
        },
      })

      const drawn = await ui.drawn()
      expect(drawn).toMatchObject({ type: 'engine', ref: 0 })
    })

    test('passes rows carrying `task` through untouched', async ($, on) => {
      on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))

      const ui = await $.ui.mount({
        plugin: 'user-message-style',
        surface,
        component: 'UserMessage',
        props: {
          text: 'build finished',
          origin: { kind: 'task-notification' },
          isExpanded: true,
          task: { id: 't1', label: 'build' },
        },
      })

      const drawn = await ui.drawn()
      expect(drawn).toMatchObject({ type: 'engine', ref: 0 })
    })

    test('draws the same border for the collapsed main-screen form', async ($) => {
      const ui = await $.ui.mount({
        plugin: 'user-message-style',
        surface,
        component: 'UserMessage',
        props: {
          text: 'fix the login bug',
          origin: { kind: 'composer' },
          isExpanded: false,
        },
      })

      const drawn = await ui.drawn()
      expect(drawn).toMatchObject({ type: 'Box', props: { borderStyle: 'round' } })
    })

    test('draws the status pane with buttons and sections', async ($, on) => {
      // The test engine has no session backing it; stand in the figures.
      on('session.usage', () => ({ value: {
        startedAt: 0,
          context: { window: 200000 },
          rateLimits: [],
        } }))
      on('session.model', () => ({ value: 'test-model' }))
      on('session.version', () => ({ value: { version: '0.0.0-test' } }))
      on('session.turns', () => ({ value: 0 }))

      const ui = await $.ui.mount({
        plugin: 'user-message-style',
        surface,
        component: 'Pane',
        requestId: 'ustyle',
        props: { title: 'session status', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { bodyRows: 24, first: 0, last: 24 } },
      })

      const drawn = await ui.drawn()
      expect(drawn).toMatchObject({ type: 'Box' })

      const buttons = await ui.findAll({ type: 'Button' })
      expect(buttons.length).toBeGreaterThanOrEqual(1)

      const texts = await ui.findAll({ type: 'Text' })
      expect(texts.some((t) => typeof t.text === 'string' && t.text.includes('context breakdown'))).toBe(true)
      expect(texts.some((t) => typeof t.text === 'string' && t.text.includes('skills'))).toBe(true)
    })
  })
}
