export type ToolStat = { calls: number; errors: number; denied: number; totalMs: number }
export type RecentCall = { id: string; tool: string; status: 'run' | 'ok' | 'err' | 'deny'; ms: number }
export type Stats = {
  startedAt: number
  prompts: number
  tools: Record<string, ToolStat>
  files: { path: string; op: 'read' | 'write' }[]
  recent: RecentCall[]
}


export type SkillPick = { name: string; why: string }
export type SkillRecs = {
  isAuto: boolean
  status: 'idle' | 'thinking' | 'error'
  note: string
  forPrompt: number
  items: SkillPick[]
  tokensIn: number
  tokensOut: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-dash': { stats: Shaped<Stats>; skills: Shaped<SkillRecs> }
  }
}
