import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'session-dash',
  component: 'Pane',
  requestId: 'session-dash',
  props: {
    title: 'Session', isFocused: false, bodyColumns: 40, placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 }, view: {},
  },
} as const

test('counts prompts, tool calls, failures and changed files', async ($, on) => {
  let t = 0
  on('clock.now', () => ({ value: (t += 100) }))
  on('command.register', () => ({ value: { command: 'session-dash' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', (_, e) => (e.tool === 'Bash' && e.command === 'false' ? { isError: true, result: 'exit 1' } : { result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'hi' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'false' })
  await $.tool.call({ tool: 'Edit', file_path: '/a/b.ts', old_string: 'x', new_string: 'y' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /prompts/ }))?.text).toMatch(/1 prompts · 3 tool calls/)
    expect((await ui.find({ type: 'Text', text: /^Bash/ }))?.text).toMatch(/Bash\s+2 .*✗1/)
    expect((await ui.find({ type: 'Text', text: /b\.ts/ }))?.text).toBe('/a/b.ts')
    await ui.unmount()
  }
})

test('widget placement shows one glance line', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, placement: 'widget' } })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('0 prompts · 0 calls · 0 failed')
  await ui.unmount()
})

const USAGE = { input_tokens: 10, output_tokens: 40, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 }

test('Refresh asks the transcript fork and lists the picks it names', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  let asked = ''
  on('model.fork', (_, e) => {
    asked = e.prompt
    return {
      value: {
        isAnswered: true,
        text: 'Sure: {"skills":[{"name":"anthropic-skills:decision-audit","why":"He is weighing a choice"},{"name":"bad name!","why":"x"}]}',
        usage: USAGE,
      },
    }
  })
  let filled = ''
  on('prompt.fill', (_, e) => {
    filled = e.text
    return { isFilled: true }
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /next turn/ }))?.text).toBe('Shown after the next turn.')
  await ui.press({ key: 'skills-refresh' })

  expect(asked).toMatch(/JSON only/)
  const pick = await ui.find({ type: 'Button', key: 'skill-anthropic-skills:decision-audit' })
  expect(pick).toBeTruthy()
  expect(await ui.find({ type: 'Button', key: 'skill-bad name!' })).toBeFalsy()
  expect((await ui.find({ type: 'Text', text: /tokens so far/ }))?.text).toMatch(/~9k in \/ 40 out/)

  await ui.press({ key: 'skill-anthropic-skills:decision-audit' })
  expect(filled).toBe('/anthropic-skills:decision-audit ')
  await ui.unmount()
})

test('a fork with no answer shows why and keeps the pane drawing', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'nothing-to-fork' } }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'skills-refresh' })
  expect((await ui.find({ type: 'Text', text: /no reply/ }))?.text).toBe('no reply: nothing-to-fork')
  await ui.unmount()
})
