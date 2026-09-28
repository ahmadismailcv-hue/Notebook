import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import { DEFAULT_ICON, type PageSummary } from '../lib/types'
import { TopBar } from '../components/Layout'
import { displayTitle, useItemActions } from '../components/actions'
import { GalleryCard, IconButton, InlineTitle, NewCard, formatDate } from '../components/collection'
import { Icon } from '../components/icons'

export function ModuleView() {
  const { moduleId = '' } = useParams()
  const ws = useWorkspace()
  const actions = useItemActions()
  const navigate = useNavigate()
  const m = ws.findModule(moduleId)
  const [details, setDetails] = useState<Record<string, PageSummary>>({})

  // Previews and dates aren't in the sidebar tree; fetch them for the gallery.
  useEffect(() => {
    void supabase
      .from('pages')
      .select('id, module_id, title, icon, banner_url, preview_text, cover_url, position, created_at, updated_at')
      .eq('module_id', moduleId)
      .then(({ data }) => setDetails(Object.fromEntries(((data as PageSummary[]) ?? []).map((p) => [p.id, p]))))
  }, [moduleId])

  if (!m)
    return (
      <>
        <TopBar crumbs={[]} />
        <main className="doc">
          <p className="status">{ws.tree ? 'This module doesn’t exist or was deleted.' : ws.error ?? 'Loading…'}</p>
        </main>
      </>
    )

  const icon = m.icon ?? DEFAULT_ICON.module
  const newPage = () => void actions.attempt(async () => navigate(`/p/${await ws.createPage(m.id)}`))

  return (
    <>
      <TopBar
        crumbs={[
          { label: displayTitle(m.notebook.title), icon: m.notebook.icon ?? DEFAULT_ICON.notebook, to: `/n/${m.notebook.id}` },
          { label: displayTitle(m.title), icon },
        ]}
        right={
          <button className="icon-btn" aria-label="Module options" onClick={(e) => actions.moduleMenu(e.currentTarget, m.id)}>
            <Icon name="more" />
          </button>
        }
      />
      <main className="doc doc-wide">
        <div className="collection-head">
          <IconButton icon={icon} onPick={(a) => actions.pickIcon(a, (i) => void actions.attempt(() => ws.updateModule(m.id, { icon: i })))} />
          <InlineTitle key={m.id} value={m.title} autoFocus={!m.title} onSave={(title) => void actions.attempt(() => ws.updateModule(m.id, { title }))} />
          <p className="collection-meta">
            {m.pages.length} {m.pages.length === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <div className="gallery gallery-pages">
          {m.pages.map((p) => {
            const d = details[p.id]
            return (
              <GalleryCard
                key={p.id}
                to={`/p/${p.id}`}
                icon={p.icon ?? DEFAULT_ICON.page}
                title={p.title}
                cover={p.banner_url || p.cover_url ? { image: p.banner_url ? null : p.cover_url, banner: p.banner_url } : undefined}
                preview={d?.preview_text}
                meta={d ? `Edited ${formatDate(d.updated_at)}` : undefined}
                onMore={(a) => actions.pageMenu(a, p.id)}
              />
            )
          })}
          <NewCard label="New page" onClick={newPage} />
        </div>
      </main>
    </>
  )
}
