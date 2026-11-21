import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { RecentCall, SkillPick, SkillRecs, Stats } from '../types'

const PANE = 'session-dash'
const EMPTY: Stats = { startedAt: 0, prompts: 0, tools: {}, files: [], recent: [] }
const stats = atom({ plugin: 'session-dash', key: 'stats' } as const, EMPTY, {
  shape: 'stats-1',
})

const NO_RECS: SkillRecs = {
  isAuto: true, status: 'idle', note: '', forPrompt: -1, items: [], tokensIn: 0, tokensOut: 0,
}
const skills = atom({ plugin: 'session-dash', key: 'skills' } as const, NO_RECS, {
  shape: 'skills-1',
})

const ASK = [
  '[Side question from the session-dash UI plugin, not from the user. Use no tools.',
  'Do not deliberate: answer straight away.]',
  'Look at the skills listed as available in this session (the Skill tool listing).',
  "From what the user is working on right now, above all their latest request, pick up to 3",
  'skills that would most help with the next step. Use only exact names from that listing.',
  'Skip a skill already in use for the current task unless running it again would help.',
  'If none clearly fits, return an empty list rather than a weak match.',
  'Reply with JSON only, no prose:',
  '{"skills":[{"name":"<exact skill name>","why":"<at most 12 words>"}]}',
].join(' ')

// Module variable: a reload starts it over, which is what we want.
let isBusy = false

function parsePicks(text: string): SkillPick[] | undefined {
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return undefined
  try {
    const raw = (JSON.parse(json) as { skills?: unknown }).skills
    if (!Array.isArray(raw)) return undefined
    return raw
      .filter((x): x is SkillPick =>
        typeof x?.name === 'string' && /^[\w:./-]{1,80}$/.test(x.name) && typeof x?.why === 'string')
      .slice(0, 3)
      .map(x => ({ name: x.name, why: x.why.slice(0, 120) }))
  } catch {
    return undefined
  }
}

async function recommend($: EngineInterface, isForced: boolean) {
  if (isBusy) return
  const prompts = (await read($, stats)).prompts
  const cur = await read($, skills)
  if (!isForced && (!cur.isAuto || cur.forPrompt === prompts)) return
  isBusy = true
  try {
    await update($, skills, r => ({ ...r, status: 'thinking' as const, note: '' }))
    const reply = await $.model.fork({ prompt: ASK })
    const u = 'usage' in reply ? reply.usage : undefined
    const tin = u ? (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : 0
    const tout = u?.output_tokens ?? 0
    const picks = reply.isAnswered ? parsePicks(reply.text) : undefined
    await update($, skills, r => ({
      ...r,
      tokensIn: r.tokensIn + tin,
      tokensOut: r.tokensOut + tout,
      forPrompt: prompts,
      ...(picks
        ? { status: 'idle' as const, items: picks, note: '' }
        : {
            status: 'error' as const,
            note: reply.isAnswered ? 'could not read the reply' : `no reply: ${reply.reason}`,
          }),
    }))
  } finally {
    isBusy = false
  }
}

const READS = new Set(['Read'])
const WRITES = new Set(['Edit', 'Write', 'NotebookEdit'])

const open = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Session' })

function fmtMs(ms: number) {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

function fmtAge(ms: number) {
  const m = Math.floor(ms / 60000)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60}m`
}

function short(path: string, width: number) {
  return path.length <= width ? path : '…' + path.slice(-(width - 1))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'session-dash',
      description: 'Open the session dashboard. Args: reset | skills | skills on | skills off',
    })
    const now = await $.clock.now()
    await update($, stats, s => (s.startedAt ? s : { ...s, startedAt: now }))
    void open($)
    return next(e)
  })

  on('command.run', { command: 'session-dash' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'skills' || arg === 'skills now') {
      await open($)
      void $.clock.after(0, () => void recommend($, true))
      return { text: 'Refreshing skill suggestions.' }
    }
    if (arg === 'skills off' || arg === 'skills on') {
      const isAuto = arg === 'skills on'
      await update($, skills, r => ({ ...r, isAuto }))
      return { text: `Automatic skill suggestions ${isAuto ? 'on' : 'off'}.` }
    }
    if (/reset/.test(arg)) {
      const now = await $.clock.now()
      await update($, stats, () => ({ ...EMPTY, startedAt: now }))
      await open($)
      return { text: 'Session dashboard reset.' }
    }
    await open($)
    return { text: 'Session dashboard opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!e.command) await update($, stats, s => ({ ...s, prompts: s.prompts + 1 }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    // Main thread only, finished normally: a subagent's turn or an aborted one says
    // little about what the person is doing.
    if (!e.agentId && e.reason === 'answer') void $.clock.after(250, () => void recommend($, false))
    return done
  })

  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id ?? `${e.tool}-${await $.clock.now()}`
    const t0 = await $.clock.now()
    const path = (e as { file_path?: unknown }).file_path
    const op: 'read' | 'write' | undefined = READS.has(e.tool) ? 'read' : WRITES.has(e.tool) ? 'write' : undefined

    await update($, stats, s => ({
      ...s,
      recent: [...s.recent, { id, tool: e.tool, status: 'run', ms: 0 } as RecentCall].slice(-50),
    }))

    const ran = await next(e)
    const ms = (await $.clock.now()) - t0
    const status: RecentCall['status'] = ran.deny !== undefined ? 'deny' : ran.isError ? 'err' : 'ok'

    await update($, stats, s => {
      const prev = s.tools[e.tool] ?? { calls: 0, errors: 0, denied: 0, totalMs: 0 }
      let files = s.files
      if (op && typeof path === 'string' && status === 'ok') {
        const rest = files.filter(f => f.path !== path)
        const was = files.find(f => f.path === path)
        files = [...rest, { path, op: was?.op === 'write' ? ('write' as const) : op }].slice(-100)
      }
      return {
        ...s,
        files,
        tools: {
          ...s.tools,
          [e.tool]: {
            calls: prev.calls + 1,
            errors: prev.errors + (status === 'err' ? 1 : 0),
            denied: prev.denied + (status === 'deny' ? 1 : 0),
            totalMs: prev.totalMs + ms,
          },
        },
        recent: s.recent.map(r => (r.id === id ? { ...r, status, ms } : r)),
      }
    })
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, stats)
    const rec = await read($, skills)
    const now = await $.clock.now()
    const width = Math.max(20, e.props.bodyColumns)
    const rows = Object.entries(s.tools).sort((a, b) => b[1].calls - a[1].calls)
    const total = rows.reduce((n, [, t]) => n + t.calls, 0)
    const fails = rows.reduce((n, [, t]) => n + t.errors + t.denied, 0)
    const written = s.files.filter(f => f.op === 'write')
    const age = s.startedAt ? fmtAge(now - s.startedAt) : '–'

    if (e.props.placement === 'widget') {
      return (
        <Text>
          {s.prompts} prompts · {total} calls · {fails} failed
        </Text>
      )
    }

    const mark = { run: '…', ok: '✓', err: '✗', deny: '⊘' } as const

    return (
      <Box flexDirection="column">
        <Text bold>
          {age} · {s.prompts} prompts · {total} tool calls
        </Text>
        <Text dimColor>
          {fails} failed/denied · {s.files.length} files touched, {written.length} changed
        </Text>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            Suggested skills{rec.status === 'thinking' ? ' …' : ''}{rec.isAuto ? '' : ' (auto off)'}
          </Text>
          {rec.items.length === 0 && rec.status !== 'thinking' && (
            <Text dimColor>{rec.forPrompt < 0 ? 'Shown after the next turn.' : 'Nothing fits right now.'}</Text>
          )}
          {rec.items.map((k, i) => (
            <Box flexDirection="column">
              <Button
                key={`skill-${k.name}`}
                hotkey={String(i + 1)}
                onPress={() => void $.prompt.fill({ text: `/${k.name} ` })}
              >
                {`/${k.name}`}
              </Button>
              <Text dimColor>  {k.why}</Text>
            </Box>
          ))}
          {rec.note !== '' && <Text dimColor>{rec.note}</Text>}
          <Box>
            <Button key="skills-refresh" hotkey="r" plain onPress={() => void recommend($, true)}>
              Refresh
            </Button>
            {rec.tokensIn > 0 && (
              <Text dimColor>
                {' '}~{Math.round(rec.tokensIn / 1000)}k in / {rec.tokensOut} out tokens so far (estimate)
              </Text>
            )}
          </Box>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>By tool</Text>
          {rows.length === 0 && <Text dimColor>No tool calls yet.</Text>}
          {rows.slice(0, 10).map(([name, t]) => (
            <Text>
              {name.padEnd(14).slice(0, 14)} {String(t.calls).padStart(4)}  avg {fmtMs(t.totalMs / t.calls)}
              {t.errors + t.denied > 0 ? `  ✗${t.errors + t.denied}` : ''}
            </Text>
          ))}
        </Box>

        {written.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Changed files</Text>
            {written.slice(-8).reverse().map(f => (
              <Text>{short(f.path, width)}</Text>
            ))}
          </Box>
        )}

        <Box flexDirection="column" marginTop={1}>
          <Text bold>Recent</Text>
          {s.recent.slice(-8).reverse().map(r => (
            <Text dimColor={r.status === 'ok'}>
              {mark[r.status]} {r.tool}{r.status === 'run' ? '' : ` ${fmtMs(r.ms)}`}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
