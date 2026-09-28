import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import { DEFAULT_ICON, type PageSummary } from '../lib/types'
import { TopBar } from '../components/Layout'
import { useItemActions } from '../components/actions'
import { GalleryCard, NewCard, formatDate } from '../components/collection'
import { Icon } from '../components/icons'

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomeView() {
  const ws = useWorkspace()
  const { session } = useAuth()
  const actions = useItemActions()
  const navigate = useNavigate()
  const [recent, setRecent] = useState<PageSummary[] | null>(null)

  useEffect(() => {
    void supabase
      .from('pages')
      .select('id, module_id, title, icon, banner_url, preview_text, cover_url, position, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setRecent((data as PageSummary[]) ?? []))
  }, [])

  const name = session?.user.email?.split('@')[0] ?? ''
  const newNotebook = () => void actions.attempt(async () => navigate(`/n/${await ws.createNotebook()}`))
  // The recent list is fetched once; titles and icons stay live through the sidebar tree.
  const recentLive = recent
    ?.filter((p) => ws.findPage(p.id))
    .map((p) => {
      const live = ws.findPage(p.id)!
      return { ...p, title: live.title, icon: live.icon, banner_url: live.banner_url, cover_url: live.cover_url }
    })

  return (
    <>
      <TopBar crumbs={[{ label: 'Home', icon: '🏠' }]} />
      <main className="doc doc-wide">
        <h1 className="home-greeting">
          {greeting()}
          {name && `, ${name}`}
        </h1>

        {!!recentLive?.length && (
          <section className="home-section">
            <h2 className="section-label">
              <Icon name="undo" size={15} /> Recently edited
            </h2>
            <div className="recent-row">
              {recentLive.map((p) => (
                <GalleryCard
                  key={p.id}
                  to={`/p/${p.id}`}
                  icon={p.icon ?? DEFAULT_ICON.page}
                  title={p.title}
                  cover={{ image: p.banner_url ? null : p.cover_url, banner: p.banner_url, color: 'var(--bg-soft)' }}
                  meta={formatDate(p.updated_at)}
                  onMore={(a) => actions.pageMenu(a, p.id)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="home-section">
          <h2 className="section-label">
            <Icon name="text" size={15} /> Notebooks
          </h2>
          {ws.error && <p className="status error">Couldn’t load: {ws.error}</p>}
          {!ws.tree && !ws.error && <p className="status">Loading…</p>}
          <div className="gallery">
            {ws.tree?.map((nb) => {
              const pages = nb.modules.flatMap((m) => m.pages)
              return (
                <GalleryCard
                  key={nb.id}
                  to={`/n/${nb.id}`}
                  icon={nb.icon ?? DEFAULT_ICON.notebook}
                  title={nb.title}
                  cover={{ color: nb.color, collage: pages.map((p) => p.cover_url ?? '').filter(Boolean) }}
                  meta={`${nb.modules.length} ${nb.modules.length === 1 ? 'module' : 'modules'} · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`}
                  onMore={(a) => actions.notebookMenu(a, nb.id)}
                />
              )
            })}
            {ws.tree && <NewCard label="New notebook" onClick={newNotebook} />}
          </div>
        </section>
      </main>
    </>
  )
}
