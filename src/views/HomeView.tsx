import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NOTEBOOK_COLORS, type Notebook } from '../lib/types'
import { useDialog } from '../components/Dialog'
import { Collage, MoreButton, SignOutButton, Status, TopBar, must, safely, useLoad } from '../components/ui'

type Row = Notebook & { modules: { id: string; pages: { cover_url: string | null }[] }[] }

export function HomeView() {
  const dialog = useDialog()
  const { data, error, reload } = useLoad(
    async () =>
      must(
        await supabase
          .from('notebooks')
          .select('*, modules(id, pages(cover_url))')
          .order('position')
          .order('updated_at', { referencedTable: 'modules.pages', ascending: false }),
      ) as Row[],
    [],
  )

  const create = () =>
    safely(async () => {
      const title = await dialog.prompt('New notebook', '', 'Create')
      if (!title) return
      const color = NOTEBOOK_COLORS[Math.floor(Math.random() * (NOTEBOOK_COLORS.length - 1))]
      must(await supabase.from('notebooks').insert({ title, color }))
      void reload()
    })

  const options = (nb: Notebook) =>
    safely(async () => {
      const action = await dialog.choose(nb.title, [
        { label: 'Rename', value: 'rename' },
        { label: 'Change colour', value: 'color' },
        { label: 'Delete notebook', value: 'delete', danger: true },
      ])
      if (action === 'rename') {
        const title = await dialog.prompt('Rename notebook', nb.title)
        if (title) must(await supabase.from('notebooks').update({ title }).eq('id', nb.id))
      } else if (action === 'color') {
        const color = await dialog.choose('Colour', NOTEBOOK_COLORS.map((c, i) => ({ label: COLOR_NAMES[i], value: c })))
        if (color) must(await supabase.from('notebooks').update({ color }).eq('id', nb.id))
      } else if (action === 'delete') {
        const ok = await dialog.confirm('Delete notebook?', `“${nb.title}” and every module and page inside it will be permanently deleted.`, {
          okLabel: 'Delete',
          danger: true,
        })
        if (ok) must(await supabase.from('notebooks').delete().eq('id', nb.id))
      }
      if (action) void reload()
    })

  return (
    <div className="shell">
      <TopBar crumbs={[{ label: 'Notebooks' }]} right={<SignOutButton />} />
      <main className="content">
        <div className="view-head">
          <h1>Notebooks</h1>
          <button className="btn btn-primary" onClick={create}>+ New notebook</button>
        </div>
        <Status error={error} loading={!data} empty={data?.length === 0 && 'No notebooks yet. Create your first one.'} />
        <div className="grid">
          {data?.map((nb) => {
            const covers = nb.modules.flatMap((m) => m.pages.map((p) => p.cover_url)).filter((u): u is string => !!u)
            const pageCount = nb.modules.reduce((n, m) => n + m.pages.length, 0)
            const dark = nb.color === '#2b2926'
            return (
              <Link key={nb.id} to={`/n/${nb.id}`} className={`card notebook-card ${dark ? 'on-dark' : ''}`} style={{ background: nb.color }}>
                <Collage urls={covers} />
                <div className="card-body">
                  <h3 className="card-title">{nb.title}</h3>
                  <p className="card-meta">
                    {nb.modules.length} {nb.modules.length === 1 ? 'module' : 'modules'} · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                  </p>
                </div>
                <MoreButton label={nb.title} onClick={() => void options(nb)} />
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}

const COLOR_NAMES = ['Sand', 'Peach', 'Sage', 'Sky', 'Lilac', 'Butter', 'Charcoal']
