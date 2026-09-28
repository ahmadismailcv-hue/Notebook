import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import { DEFAULT_ICON } from '../lib/types'
import { displayTitle } from './actions'
import { Icon } from './icons'

const Ctx = createContext<() => void>(() => {})
export const useOpenSearch = () => useContext(Ctx)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      {open && <SearchDialog close={() => setOpen(false)} />}
    </Ctx.Provider>
  )
}

interface Hit {
  id: string
  title: string
  body_text: string
  updated_at: string
}

// PostgREST filter values: escape the characters that would break an or=(...) expression.
const pattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()"]/g, ' ')}%`

function snippet(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return null
  const start = Math.max(0, i - 50)
  const end = Math.min(text.length, i + q.length + 90)
  return { before: (start > 0 ? '…' : '') + text.slice(start, i), match: text.slice(i, i + q.length), after: text.slice(i + q.length, end) + (end < text.length ? '…' : '') }
}

function SearchDialog({ close }: { close: () => void }) {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const query = q.trim()

  useEffect(() => {
    if (!query) {
      setHits(null)
      return
    }
    let stale = false
    const t = window.setTimeout(async () => {
      const p = pattern(query)
      const { data, error: err } = await supabase
        .from('pages')
        .select('id, title, body_text, updated_at')
        .or(`title.ilike.${p},body_text.ilike.${p}`)
        .order('updated_at', { ascending: false })
        .limit(30)
      if (stale) return
      setError(err ? err.message : null)
      setHits((data as Hit[]) ?? [])
      setIndex(0)
    }, 180)
    return () => {
      stale = true
      window.clearTimeout(t)
    }
  }, [query])

  // Notebooks and modules are searched locally from the sidebar tree.
  const containers = useMemo(() => {
    if (!query || !ws.tree) return []
    const ql = query.toLowerCase()
    const out: { kind: 'n' | 'm'; id: string; title: string; icon: string; path: string }[] = []
    for (const n of ws.tree) {
      if (n.title.toLowerCase().includes(ql)) out.push({ kind: 'n', id: n.id, title: n.title, icon: n.icon ?? DEFAULT_ICON.notebook, path: '' })
      for (const m of n.modules)
        if (m.title.toLowerCase().includes(ql)) out.push({ kind: 'm', id: m.id, title: m.title, icon: m.icon ?? DEFAULT_ICON.module, path: displayTitle(n.title) })
    }
    return out.slice(0, 6)
  }, [query, ws.tree])

  const recent = useMemo(() => {
    if (query || !ws.tree) return []
    return ws.tree.flatMap((n) => n.modules.flatMap((m) => m.pages.map((p) => ({ p, m, n })))).slice(-6).reverse()
  }, [query, ws.tree])

  type Row = { key: string; go: () => void; node: ReactNode }
  const rows: Row[] = []
  for (const c of containers)
    rows.push({
      key: c.kind + c.id,
      go: () => navigate(`/${c.kind}/${c.id}`),
      node: (
        <>
          <span className="sr-icon">{c.icon}</span>
          <span className="sr-main">
            <span className="sr-title">{displayTitle(c.title)}</span>
            <span className="sr-path">{c.kind === 'n' ? 'Notebook' : `Module · ${c.path}`}</span>
          </span>
        </>
      ),
    })
  for (const h of hits ?? []) {
    const loc = ws.findPage(h.id)
    const s = snippet(h.body_text, query)
    rows.push({
      key: 'p' + h.id,
      go: () => navigate(`/p/${h.id}`),
      node: (
        <>
          <span className="sr-icon">{loc?.icon ?? DEFAULT_ICON.page}</span>
          <span className="sr-main">
            <span className="sr-title">{displayTitle(h.title)}</span>
            {loc && (
              <span className="sr-path">
                {displayTitle(loc.notebook.title)} / {displayTitle(loc.module.title)}
              </span>
            )}
            {s && (
              <span className="sr-snippet">
                {s.before}
                <mark>{s.match}</mark>
                {s.after}
              </span>
            )}
          </span>
        </>
      ),
    })
  }
  for (const { p, m, n } of recent)
    rows.push({
      key: 'r' + p.id,
      go: () => navigate(`/p/${p.id}`),
      node: (
        <>
          <span className="sr-icon">{p.icon ?? DEFAULT_ICON.page}</span>
          <span className="sr-main">
            <span className="sr-title">{displayTitle(p.title)}</span>
            <span className="sr-path">
              {displayTitle(n.title)} / {displayTitle(m.title)}
            </span>
          </span>
        </>
      ),
    })

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const choose = (r: Row | undefined) => {
    if (!r) return
    close()
    r.go()
  }

  return createPortal(
    <div className="search-backdrop" onMouseDown={close}>
      <div className="search" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-bar">
          <Icon name="search" />
          <input
            autoFocus
            className="search-input"
            placeholder="Search pages, notes, notebooks…"
            value={q}
            enterKeyHint="search"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(rows.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') choose(rows[index])
            }}
          />
          <button className="search-close" onClick={close}>
            Cancel
          </button>
        </div>
        <div className="search-results" ref={listRef}>
          {!query && recent.length > 0 && <div className="menu-title">Jump to</div>}
          {error && <p className="status error">Search failed: {error}</p>}
          {query && hits && rows.length === 0 && <p className="search-empty">No results for “{query}”</p>}
          {rows.map((r, i) => (
            <button key={r.key} data-i={i} className={`sr-row ${i === index ? 'selected' : ''}`} onMouseMove={() => i !== index && setIndex(i)} onClick={() => choose(r)}>
              {r.node}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
