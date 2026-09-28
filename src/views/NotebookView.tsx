import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Module, Notebook } from '../lib/types'
import { useDialog } from '../components/Dialog'
import { Collage, MoreButton, SignOutButton, Status, TopBar, must, safely, useLoad } from '../components/ui'

type Row = Module & { pages: { cover_url: string | null }[] }

export function NotebookView() {
  const { notebookId = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useDialog()
  const { data, error, reload } = useLoad(async () => {
    const [nb, mods] = await Promise.all([
      supabase.from('notebooks').select('*').eq('id', notebookId).single(),
      supabase
        .from('modules')
        .select('*, pages(cover_url)')
        .eq('notebook_id', notebookId)
        .order('position')
        .order('updated_at', { referencedTable: 'pages', ascending: false }),
    ])
    return { notebook: must(nb) as Notebook, modules: must(mods) as Row[] }
  }, [notebookId])

  const create = () =>
    safely(async () => {
      const title = await dialog.prompt('New module', '', 'Create')
      if (!title) return
      const mod = must(await supabase.from('modules').insert({ title, notebook_id: notebookId }).select('id').single())
      navigate(`/m/${mod.id}`)
    })

  const options = (m: Module) =>
    safely(async () => {
      const action = await dialog.choose(m.title, [
        { label: 'Rename', value: 'rename' },
        { label: 'Delete module', value: 'delete', danger: true },
      ])
      if (action === 'rename') {
        const title = await dialog.prompt('Rename module', m.title)
        if (title) must(await supabase.from('modules').update({ title }).eq('id', m.id))
      } else if (action === 'delete') {
        const ok = await dialog.confirm('Delete module?', `“${m.title}” and every page inside it will be permanently deleted.`, {
          okLabel: 'Delete',
          danger: true,
        })
        if (ok) must(await supabase.from('modules').delete().eq('id', m.id))
      }
      if (action) void reload()
    })

  const title = data?.notebook.title ?? '…'

  return (
    <div className="shell">
      <TopBar crumbs={[{ label: 'Notebooks', to: '/' }, { label: title }]} right={<SignOutButton />} />
      <main className="content">
        <div className="view-head">
          <h1>{title}</h1>
          <button className="btn btn-primary" onClick={create}>+ New module</button>
        </div>
        <Status error={error} loading={!data} empty={data?.modules.length === 0 && 'No modules yet. Modules group related pages, like chapters.'} />
        <div className="grid">
          {data?.modules.map((m) => {
            const covers = m.pages.map((p) => p.cover_url).filter((u): u is string => !!u)
            return (
              <Link key={m.id} to={`/m/${m.id}`} className="card module-card">
                <Collage urls={covers} />
                <div className="card-body">
                  <h3 className="card-title">{m.title}</h3>
                  <p className="card-meta">
                    {m.pages.length} {m.pages.length === 1 ? 'page' : 'pages'}
                  </p>
                </div>
                <MoreButton label={m.title} onClick={() => void options(m)} />
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
