import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Module, PageSummary } from '../lib/types'
import { useDialog } from '../components/Dialog'
import { MoreButton, SignOutButton, Status, TopBar, formatDate, must, safely, useLoad } from '../components/ui'

type ModuleRow = Module & { notebooks: { id: string; title: string } }

export function ModuleView() {
  const { moduleId = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useDialog()
  const { data, error, reload } = useLoad(async () => {
    const [mod, pages] = await Promise.all([
      supabase.from('modules').select('*, notebooks(id, title)').eq('id', moduleId).single(),
      supabase
        .from('pages')
        .select('id, module_id, title, preview_text, cover_url, position, created_at, updated_at')
        .eq('module_id', moduleId)
        .order('position'),
    ])
    return { module: must(mod) as ModuleRow, pages: must(pages) as PageSummary[] }
  }, [moduleId])

  const create = () =>
    safely(async () => {
      const page = must(await supabase.from('pages').insert({ module_id: moduleId }).select('id').single())
      navigate(`/p/${page.id}`)
    })

  const options = (p: PageSummary) =>
    safely(async () => {
      const label = p.title || 'Untitled'
      const action = await dialog.choose(label, [{ label: 'Delete page', value: 'delete', danger: true }])
      if (action !== 'delete') return
      const ok = await dialog.confirm('Delete page?', `“${label}” will be permanently deleted.`, { okLabel: 'Delete', danger: true })
      if (!ok) return
      must(await supabase.from('pages').delete().eq('id', p.id))
      void reload()
    })

  const nb = data?.module.notebooks
  const title = data?.module.title ?? '…'

  return (
    <div className="shell">
      <TopBar
        crumbs={[{ label: 'Notebooks', to: '/' }, { label: nb?.title ?? '…', to: nb ? `/n/${nb.id}` : undefined }, { label: title }]}
        right={<SignOutButton />}
      />
      <main className="content">
        <div className="view-head">
          <h1>{title}</h1>
          <button className="btn btn-primary" onClick={create}>+ New page</button>
        </div>
        <Status error={error} loading={!data} empty={data?.pages.length === 0 && 'No pages yet.'} />
        <div className="masonry">
          {data?.pages.map((p) => (
            <Link key={p.id} to={`/p/${p.id}`} className="card page-card">
              {p.cover_url && <img className="page-card-cover" src={p.cover_url} alt="" loading="lazy" />}
              <div className="card-body">
                <h3 className={`card-title ${p.title ? '' : 'untitled'}`}>{p.title || 'Untitled'}</h3>
                {p.preview_text && <p className="card-preview">{p.preview_text}</p>}
                <p className="card-meta">{formatDate(p.updated_at)}</p>
              </div>
              <MoreButton label={p.title || 'Untitled'} onClick={() => void options(p)} />
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
