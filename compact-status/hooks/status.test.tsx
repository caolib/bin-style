import { describe, expect, mock, test } from 'claude-code/testing'
import type { TurnUsage } from 'claude-code'
import { basename, cachePercent, diffCounts, statusText } from './format'

const BAND = {
  plugin: 'compact-status', component: 'AbovePrompt',
  props: {
    hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 4 }, view: {},
  },
} as const

const USAGE: TurnUsage = {
  model: 'gpt-6-astra', input_tokens: 2500, cache_read_input_tokens: 74500,
  cache_creation_input_tokens: 0, output_tokens: 350,
}

const STATS = {
  model: 'gpt-6-astra', effort: 'xhigh', cacheHit: cachePercent(USAGE),
}
const REPO = {
  cwd: 'C:/code/bin-style', directory: 'bin-style', branch: 'main',
  added: 0, removed: 0, ahead: 0, behind: 0,
}

test('formats actual context, last input cache coverage and total window', async () => {
  expect(statusText('gpt-6-astra', 'xhigh', { window: 922000, tokens: 77000, percent: 8 }, STATS, REPO, REPO.cwd))
    .toBe('gpt-6-astra(xhigh)  ·  8.0% / 922.0k  ·  77.0k (96.8%)  ·  bin-style  ·  main (+0,-0)')
})

test('shows only the last model path segment', async () => {
  const text = statusText('provider/group/gpt-6-astra', 'xhigh', { window: 922000 }, null, null, '/')
  expect(text.startsWith('gpt-6-astra(xhigh)')).toBe(true)
  expect(text.includes('provider')).toBe(false)
  expect(statusText('plain-model', null, { window: 1000000 }, null, null, '/').startsWith('plain-model')).toBe(true)
})

test('handles missing data without inventing zero measurements', async () => {
  const text = statusText('test-model', null, { window: 1000000 }, null, null, 'C:\\code\\项目\\')
  expect(text).toBe('test-model  ·  — / 1000.0k  ·  — (—)  ·  项目  ·  git: —')
  expect(text.includes('\ue0b6')).toBe(false)
  expect(basename('/')).toBe('/')
})

test('ignores stale repo after a directory change and cache after compaction', async () => {
  const text = statusText('m', null, { window: 922000 }, STATS, REPO, '/tmp/other')
  expect(text.includes('— (—)')).toBe(true)
  expect(text.includes('other  ·  git: —')).toBe(true)
})

test('shows tracking counts after the branch', async () => {
  const text = statusText('m', null, { window: 1000 }, null, { ...REPO, ahead: 2, behind: 3 }, REPO.cwd)
  expect(text.endsWith('main ↑2↓3 (+0,-0)')).toBe(true)
  const clean = statusText('m', null, { window: 1000 }, null, { ...REPO, ahead: null, behind: null }, REPO.cwd)
  expect(clean.endsWith('main (+0,-0)')).toBe(true)
})

test('includes uncached inputs and cache writes in cache coverage', async () => {
  expect(cachePercent({ ...USAGE, input_tokens: 100, cache_creation_input_tokens: 200, cache_read_input_tokens: 700 })).toBe(70)
  expect(cachePercent({ ...USAGE, input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 })).toBe(null)
  expect(diffCounts('3\t2\ta.ts\n-\t-\timage.png\n5\t1\tb.ts\n')).toEqual({ added: 8, removed: 3 })
})

for (const surface of ['terminal', 'desktop'] as const) {
  describe(surface, () => {
    test('renders one powerline row at narrow widths', async ($, on) => {
      on('session.model', () => ({ value: 'gpt-6-astra' }))
      on('session.cwd', () => ({ value: REPO.cwd }))
      on('session.usage', () => ({ value: { startedAt: 0, context: { window: 922000, tokens: 77000, percent: 8 }, rateLimits: [] } }))
      on('env.get', () => ({ value: 'xhigh' }))
      on('state.get', (_, e) => ({ value: { value: e.key === 'response' ? STATS : e.key === 'git' ? REPO : 0, version: 1 } }))
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: 45 } })
      expect(await ui.drawn()).toMatchObject({ type: 'Box', props: {
        width: 45, height: 1, minHeight: 1, margin: 0, padding: 0, overflow: 'hidden',
      } })
      const texts = await ui.findAll({ type: 'Text' })
      const boxes = await ui.findAll({ type: 'Box' })
      const text = texts.map(t => t.text).join('')
      expect(text).toContain('77.0k (96.8%)')
      expect(texts.find(t => t.text === '96.8%')?.props.color).toBe('#0b0b0b')
      expect(text.includes('t/s')).toBe(false)
      const chips = boxes.filter(t => typeof t.props.backgroundColor === 'string')
      for (const expected of ['#7fb0e8', '#f0a070', '#7ecfa6', '#e9c46a', '#282828']) {
        expect(chips.some(t => t.props.backgroundColor === expected), expected).toBe(true)
      }
      expect(texts.find(t => t.text.includes('gpt-6-astra'))?.props.color).toBe('#0b0b0b')
      expect(texts.find(t => t.text.includes('main'))?.props.color).toBe('#f0efec')
      const caps = texts.filter(t => ['', ''].includes(t.text))
      expect(caps.map(t => t.text)).toEqual(['', '', '', '', '', ''])
      expect(caps[0]?.props.color).toBe('#7fb0e8')
      expect(caps[1]?.props.color).toBe('#7ecfa6')
      expect(caps[4]?.props.color).toBe('#282828')
      expect(caps[5]?.props.color).toBe('#282828')
      expect(boxes.filter(t => t.props.backgroundColor === '#7fb0e8').length).toBe(2)
      expect(texts.find(t => t.text === '+0')?.props.color).toBe('#7ecfa6')
      expect(texts.find(t => t.text === '-0')?.props.color).toBe('#f28b82')
      await ui.unmount()
    })

    test('yields the band when the engine has a survey', async ($, on) => {
      on('ui.render', ($, e) => {
        const { Text } = $.ui.resolve(e)
        return <Text>survey</Text>
      })
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
      expect((await ui.find({ type: 'Text' }))?.text).toBe('survey')
      await ui.unmount()
    })
  })
}

test('applies a preset theme', {
  options: { theme: 'gruvbox' },
}, async ($, on) => {
  on('session.model', () => ({ value: 'gpt-6-astra' }))
  on('session.cwd', () => ({ value: REPO.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 922000 }, rateLimits: [] } }))
  on('env.get', () => ({ value: 'xhigh' }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = await ui.findAll({ type: 'Text' })
  const boxes = await ui.findAll({ type: 'Box' })
  expect(texts.find(t => t.text.includes('gpt-6-astra'))?.props.color).toBe('#1d2021')
  expect(boxes.some(b => b.props.backgroundColor === '#fe8019')).toBe(true)
  expect(boxes.some(b => b.props.backgroundColor === '#282828')).toBe(true)
  await ui.unmount()
})

test('plain theme paints foreground colours without backgrounds', {
  options: { theme: 'plain' },
}, async ($, on) => {
  on('session.model', () => ({ value: 'gpt-6-astra' }))
  on('session.cwd', () => ({ value: REPO.cwd }))
  on('session.usage', () => ({ value: {
    startedAt: 0, context: { window: 922000, tokens: 77000, percent: 8 }, rateLimits: [],
  } }))
  on('env.get', () => ({ value: 'xhigh' }))
  on('state.get', (_, e) => ({ value: { value: e.key === 'response' ? STATS : e.key === 'git' ? REPO : 0, version: 1 } }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.some(b => typeof b.props.backgroundColor === 'string')).toBe(false)
  const texts = await ui.findAll({ type: 'Text' })
  expect(texts.find(t => t.text.includes('gpt-6-astra'))?.props.color).toBe('#7fb0e8')
  expect(texts.find(t => t.text.includes('77.0k'))?.props.color).toBe('#c8c8c8')
  expect(texts.filter(t => t.text === '·').length).toBe(4)
  expect(texts.find(t => t.text === '96.8%')?.props.color).toBe('#7ecfa6')
  await ui.unmount()
})

test('plain keeps a cache hit under 90% red while painted themes stay neutral', {
  options: { theme: 'plain' },
}, async ($, on) => {
  on('session.model', () => ({ value: 'm' }))
  on('session.cwd', () => ({ value: REPO.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 922000, tokens: 77000 }, rateLimits: [] } }))
  on('env.get', () => ({ value: 'xhigh' }))
  on('state.get', (_, e) => ({ value: {
    value: e.key === 'response' ? { model: 'm', effort: null, cacheHit: 42 } : null,
    version: 1,
  } }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const texts = await ui.findAll({ type: 'Text' })
  expect(texts.find(t => t.text === '42.0%')?.props.color).toBe('#f28b82')
  await ui.unmount()
})

test('previews every theme in the status-theme pane', async $ => {
  const ui = await $.ui.mount({
    plugin: 'compact-status', component: 'Pane', requestId: 'status-theme', surface: 'terminal',
    props: {
      title: '状态栏配色', isFocused: true, bodyColumns: 80, placement: 'dock',
      scroll: { offset: 0, bodyRows: 20 }, view: {},
    },
  })
  const boxes = await ui.findAll({ type: 'Box' })
  const swatches = boxes.map(b => b.props.backgroundColor).filter(b => typeof b === 'string')
  expect(swatches.length).toBeGreaterThanOrEqual(7 * 5)
  for (const background of ['#7fb0e8', '#61afef', '#7aa2f7', '#83a598', '#88c0d0', '#89b4fa', '#b8b8b8']) {
    expect(swatches.includes(background), background).toBe(true)
  }
  const names = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(names).toContain('onedark')
  expect(names).toContain('plain')
  expect(names.match(/gpt-6-astra\(xhigh\)/g)?.length).toBe(8)
  expect(names).toContain('main (+123,-456)')
  await ui.unmount()
})

test('observes main-thread steps without changing their chunks or result', async ($, on) => {
  const result = { turnId: 't', index: 0, answer: 'hello', toolUses: [], stopReason: 'end_turn' as const, usage: USAGE }
  on('clock.now', () => { throw new Error('TPS timing must not run') })
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'hello' }
    return result
  })
  let saved: unknown
  on('state.set', async (_, e, next) => {
    if (e.key === 'response') saved = e.value
    return next(e)
  })
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'gpt-6-astra', effort: 'xhigh', messageCount: 1 })
  let item = await stream.next()
  const chunks: unknown[] = []
  while (!item.done) { chunks.push(item.value); item = await stream.next() }
  expect(chunks).toEqual([{ kind: 'text', index: 0, text: 'hello' }])
  expect(item.value).toEqual(result)
  expect(saved).toMatchObject(STATS)
})

test('ignores subagent usage', async ($, on) => {
  on('turn.step', async function* () {
    return { turnId: 'agent-turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: USAGE }
  })
  let writes = 0
  on('state.set', (_, e, next) => { writes += 1; return next(e) })
  const stream = $.turn.step({ turnId: 'agent-turn', index: 0, model: 'worker', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) { /* Preserve the stream. */ }
  expect(writes).toBe(0)
})

for (const inRepo of [true, false]) {
  test(`initializes and refreshes Git safely (repository=${inRepo})`, async ($, on) => {
    const clock = mock.clock(on, { now: 1000 })
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('session.model', () => ({ value: 'gpt-6-astra' }))
    on('session.cwd', () => ({ value: REPO.cwd }))
    on('env.get', () => ({ value: 'xhigh' }))
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 922000, tokens: 77000 }, rateLimits: [] } }))
    let gitWrites = 0
    let saved: unknown
    on('state.set', (_, e, next) => {
      if (e.key === 'git') { gitWrites += 1; saved = e.value }
      return next(e)
    })
    let gitCalls = 0
    on('process.run', (_, e) => {
      gitCalls += 1
      expect(e.argv[0]).toBe('git')
      expect(e.argv.includes('--no-optional-locks')).toBe(true)
      expect(e.init?.cwd).toBe(REPO.cwd)
      const stdout = e.argv.includes('--show-toplevel') ? REPO.cwd + '\n'
        : e.argv.includes('symbolic-ref') ? 'main\n'
        : e.argv.includes('rev-list') ? '1\t2\n'
        : e.argv.includes('--cached') ? '5\t1\ta.ts\n' : '3\t2\tb.ts\n'
      return { value: { exitCode: inRepo ? 0 : 128, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    await $.session.start({ cwd: REPO.cwd, surface: 'terminal', isInteractive: true })
    expect(saved).toMatchObject(inRepo
      ? { ...REPO, added: 8, removed: 3, ahead: 2, behind: 1 }
      : { ...REPO, branch: null, added: null, removed: null, ahead: null, behind: null })
    expect(gitWrites).toBe(1)
    await clock.advance(5000)
    expect(gitCalls).toBe(inRepo ? 10 : 2)
    expect(gitWrites).toBe(1)
  })
}

test('clears stale response metrics on /clear', async ($, on) => {
  let saved: unknown = STATS
  on('state.get', () => ({ value: { value: saved, version: 1 } }))
  on('state.set', (_, e) => { saved = e.value; return { value: { isSet: true, version: 2 } } })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await $.session.end({ reason: 'clear', sessionId: 's', resume: { id: 's' } })
  expect(saved).toBe(null)
})
