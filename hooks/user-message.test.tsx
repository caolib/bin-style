import { test, expect, describe } from 'claude-code/testing'
import type { Register } from 'claude-code'

/** The register under test, loaded by `claude plugin test` from this folder. */
declare const register: Register

const OWN: Array<{ kind: string; label: string }> = [
  { kind: 'composer', label: 'typed at the prompt' },
  { kind: 'bridge', label: 'sent from a phone/web client' },
]

const OTHER: Array<{ kind: string; label: string }> = [
  { kind: 'task-notification', label: 'background task notification' },
  { kind: 'peer', label: 'another session' },
  { kind: 'unclassified', label: 'unclassified' },
]

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
        expect(drawn).toMatchObject({ type: 'Box' })
        expect(drawn).not.toMatchObject({ type: 'engine' })

        const texts = await ui.findAll({ type: 'Text' })
        expect(texts.length).toBeGreaterThan(0)
        expect(
          texts.some((t) => typeof t.text === 'string' && t.text.includes('fix the login bug'))
        ).toBe(true)
      })
    }

    for (const { kind, label } of OTHER) {
      test(`passes ${label} rows through untouched`, async ($, on) => {
        // Stand for the engine's own drawing: nothing beneath the plugins.
        on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))

        const ui = await $.ui.mount({
          plugin: 'user-message-style',
          surface,
          component: 'UserMessage',
          props: {
            text: 'a notification arrives',
            origin: { kind },
            isExpanded: true,
          },
        })

        const drawn = await ui.drawn()
        expect(drawn).toMatchObject({ type: 'engine', ref: 0 })
      })
    }

    test(`draws the same border for the collapsed main-screen form`, async ($) => {
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
  })
}
