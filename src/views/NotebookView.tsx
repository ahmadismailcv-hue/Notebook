import { useNavigate, useParams } from 'react-router-dom'
import { useWorkspace } from '../lib/workspace'
import { DEFAULT_ICON } from '../lib/types'
import { TopBar } from '../components/Layout'
import { displayTitle, useItemActions } from '../components/actions'
import { GalleryCard, IconButton, InlineTitle, NewCard } from '../components/collection'
import { Icon } from '../components/icons'

export function NotebookView() {
  const { notebookId = '' } = useParams()
  const ws = useWorkspace()
  const actions = useItemActions()
  const navigate = useNavigate()
  const nb = ws.findNotebook(notebookId)

  if (!nb)
    return (
      <>
        <TopBar crumbs={[]} />
        <main className="doc">
          <p className="status">{ws.tree ? 'This notebook doesn’t exist or was deleted.' : ws.error ?? 'Loading…'}</p>
        </main>
      </>
    )

  const icon = nb.icon ?? DEFAULT_ICON.notebook
  const newModule = () => void actions.attempt(async () => navigate(`/m/${await ws.createModule(nb.id)}`))

  return (
    <>
      <TopBar
        crumbs={[{ label: displayTitle(nb.title), icon }]}
        right={
          <button className="icon-btn" aria-label="Notebook options" onClick={(e) => actions.notebookMenu(e.currentTarget, nb.id)}>
            <Icon name="more" />
          </button>
        }
      />
      <main className="doc doc-wide">
        <div className="collection-head">
          <IconButton icon={icon} onPick={(a) => actions.pickIcon(a, (i) => void actions.attempt(() => ws.updateNotebook(nb.id, { icon: i })))} />
          <InlineTitle key={nb.id} value={nb.title} autoFocus={!nb.title} onSave={(title) => void actions.attempt(() => ws.updateNotebook(nb.id, { title }))} />
          <p className="collection-meta">
            {nb.modules.length} {nb.modules.length === 1 ? 'module' : 'modules'}
          </p>
        </div>
        <div className="gallery">
          {nb.modules.map((m) => (
            <GalleryCard
              key={m.id}
              to={`/m/${m.id}`}
              icon={m.icon ?? DEFAULT_ICON.module}
              title={m.title}
              cover={{ collage: m.pages.map((p) => p.cover_url ?? '').filter(Boolean), color: 'var(--bg-soft)' }}
              meta={`${m.pages.length} ${m.pages.length === 1 ? 'page' : 'pages'}`}
              onMore={(a) => actions.moduleMenu(a, m.id)}
            />
          ))}
          <NewCard label="New module" onClick={newModule} />
        </div>
      </main>
    </>
  )
}
