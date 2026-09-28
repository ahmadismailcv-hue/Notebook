import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import { DEFAULT_ICON } from '../lib/types'
import { displayTitle, useItemActions } from './actions'
import { Icon } from './icons'
import { useLayout } from './Layout'
import { useOpenSearch } from './Search'

function useExpanded() {
  const [open, setOpen] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('nb:expanded') ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const save = (next: Set<string>) => {
    setOpen(next)
    try {
      localStorage.setItem('nb:expanded', JSON.stringify([...next]))
    } catch {
      /* ignore */
    }
  }
  return {
    isOpen: (id: string) => open.has(id),
    toggle: (id: string) => {
      const next = new Set(open)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      save(next)
    },
    ensure: (ids: string[]) => {
      if (ids.every((id) => open.has(id))) return
      save(new Set([...open, ...ids]))
    },
  }
}

interface RowProps {
  depth: number
  icon: string
  title: string
  to: string
  active: boolean
  expandable: boolean
  expanded?: boolean
  onToggle?: () => void
  onAdd?: () => void
  addLabel?: string
  onMore: (anchor: HTMLElement) => void
  children?: ReactNode
}

function Row({ depth, icon, title, to, active, expandable, expanded, onToggle, onAdd, addLabel, onMore, children }: RowProps) {
  return (
    <>
      <div className={`sb-row ${active ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}>
        {expandable ? (
          <button className={`sb-toggle ${expanded ? 'open' : ''}`} onClick={onToggle} aria-label={expanded ? 'Collapse' : 'Expand'}>
            <Icon name="chevronRight" size={14} />
          </button>
        ) : (
          <span className="sb-toggle-spacer" />
        )}
        <Link to={to} className="sb-link">
          <span className="sb-icon">{icon}</span>
          <span className={`sb-title ${title ? '' : 'untitled'}`}>{displayTitle(title)}</span>
        </Link>
        <span className="sb-actions">
          <button className="sb-action" aria-label={`Options for ${displayTitle(title)}`} onClick={(e) => onMore(e.currentTarget)}>
            <Icon name="more" size={16} />
          </button>
          {onAdd && (
            <button className="sb-action" aria-label={addLabel} onClick={onAdd}>
              <Icon name="plus" size={16} />
            </button>
          )}
        </span>
      </div>
      {expanded && children}
    </>
  )
}

export function Sidebar() {
  const ws = useWorkspace()
  const { session } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { toggleSidebar, isPhone } = useLayout()
  const actions = useItemActions()
  const expanded = useExpanded()
  const openSearch = useOpenSearch()

  const [, kind, id] = pathname.split('/')

  // Reveal the current item in the tree.
  useEffect(() => {
    if (!ws.tree || !id) return
    if (kind === 'm') {
      const m = ws.findModule(id)
      if (m) expanded.ensure([m.notebook_id])
    } else if (kind === 'p') {
      const p = ws.findPage(id)
      if (p) expanded.ensure([p.notebook.id, p.module.id])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, ws.tree])

  const create = (fn: () => Promise<string>, route: string, parent?: string[]) =>
    void actions.attempt(async () => {
      const newId = await fn()
      if (parent) expanded.ensure(parent)
      navigate(`${route}/${newId}`)
    })

  const email = session?.user.email ?? ''
  const name = email.split('@')[0]

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sb-head">
        <div className="sb-workspace">
          <span className="sb-avatar">{(name[0] ?? 'N').toUpperCase()}</span>
          <span className="sb-workspace-name">{name ? `${name}’s Notebook` : 'Notebook'}</span>
        </div>
        <button className="icon-btn sb-collapse" onClick={toggleSidebar} aria-label="Close sidebar">
          <Icon name={isPhone ? 'chevronsLeft' : 'chevronsLeft'} />
        </button>
      </div>

      <nav className="sb-scroll">
        <button className="sb-nav" onClick={openSearch}>
          <Icon name="search" size={17} />
          <span>Search</span>
          <kbd className="sb-kbd">⌘K</kbd>
        </button>
        <Link to="/" className={`sb-nav ${pathname === '/' ? 'active' : ''}`}>
          <Icon name="home" size={17} />
          <span>Home</span>
        </Link>

        <div className="sb-section">
          <span>Notebooks</span>
          <button className="sb-action" aria-label="New notebook" onClick={() => create(ws.createNotebook, '/n')}>
            <Icon name="plus" size={16} />
          </button>
        </div>

        {ws.error && <p className="sb-empty error">Couldn’t load: {ws.error}</p>}
        {ws.tree?.length === 0 && <p className="sb-empty">No notebooks yet</p>}
        {ws.tree?.map((nb) => (
          <Row
            key={nb.id}
            depth={0}
            icon={nb.icon ?? DEFAULT_ICON.notebook}
            title={nb.title}
            to={`/n/${nb.id}`}
            active={kind === 'n' && id === nb.id}
            expandable
            expanded={expanded.isOpen(nb.id)}
            onToggle={() => expanded.toggle(nb.id)}
            onAdd={() => create(() => ws.createModule(nb.id), '/m', [nb.id])}
            addLabel="New module"
            onMore={(a) => actions.notebookMenu(a, nb.id)}
          >
            {nb.modules.length === 0 && <p className="sb-empty" style={{ paddingLeft: 44 }}>No modules</p>}
            {nb.modules.map((m) => (
              <Row
                key={m.id}
                depth={1}
                icon={m.icon ?? DEFAULT_ICON.module}
                title={m.title}
                to={`/m/${m.id}`}
                active={kind === 'm' && id === m.id}
                expandable
                expanded={expanded.isOpen(m.id)}
                onToggle={() => expanded.toggle(m.id)}
                onAdd={() => create(() => ws.createPage(m.id), '/p', [nb.id, m.id])}
                addLabel="New page"
                onMore={(a) => actions.moduleMenu(a, m.id)}
              >
                {m.pages.length === 0 && <p className="sb-empty" style={{ paddingLeft: 58 }}>No pages</p>}
                {m.pages.map((p) => (
                  <Row
                    key={p.id}
                    depth={2}
                    icon={p.icon ?? DEFAULT_ICON.page}
                    title={p.title}
                    to={`/p/${p.id}`}
                    active={kind === 'p' && id === p.id}
                    expandable={false}
                    onMore={(a) => actions.pageMenu(a, p.id)}
                  />
                ))}
              </Row>
            ))}
          </Row>
        ))}

        <button className="sb-nav sb-new" onClick={() => create(ws.createNotebook, '/n')}>
          <Icon name="plus" size={17} />
          <span>New notebook</span>
        </button>
      </nav>

      <div className="sb-foot">
        <button className="sb-nav" onClick={() => void supabase.auth.signOut()}>
          <Icon name="logout" size={17} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
