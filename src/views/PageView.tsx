import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Page } from '../lib/types'
import { clearDraft, readDraft, usePageSaver, type SaveState, type Snapshot } from '../lib/pageSaver'
import { useDialog } from '../components/Dialog'
import { Status, TopBar, must } from '../components/ui'
import { PageEditor } from '../editor/PageEditor'

type PageRow = Page & { modules: { id: string; title: string; notebooks: { id: string; title: string } } }

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved',
  error: 'Save failed – retrying',
  offline: 'Offline – kept on this device',
}

const same = (a: Snapshot, b: Snapshot) => a.title === b.title && JSON.stringify(a.content) === JSON.stringify(b.content)

export function PageView() {
  const { pageId = '' } = useParams()
  const dialog = useDialog()
  const saver = usePageSaver(pageId)
  const [row, setRow] = useState<PageRow | null>(null)
  const [initial, setInitial] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRow(null)
    setInitial(null)
    ;(async () => {
      try {
        const page = must(
          await supabase.from('pages').select('*, modules(id, title, notebooks(id, title))').eq('id', pageId).single(),
        ) as PageRow
        if (cancelled) return
        const server: Snapshot = { title: page.title, content: page.content }
        let start = server
        let push = false
        const draft = readDraft(pageId)
        if (draft) {
          if (same(draft, server)) clearDraft(pageId)
          else if (!draft.base || draft.base === page.updated_at) {
            start = { title: draft.title, content: draft.content }
            push = true
          } else {
            const keepLocal = await dialog.confirm(
              'Unsynced changes found',
              `This device has edits from ${new Date(draft.ts).toLocaleString()} that were never saved, but the page was changed elsewhere since. Keep this device’s version? Choosing Cancel keeps the version from the cloud and discards the local edits.`,
              { okLabel: 'Keep this device’s version' },
            )
            if (keepLocal) {
              start = { title: draft.title, content: draft.content }
              push = true
            } else clearDraft(pageId)
          }
        }
        if (cancelled) return
        saver.setBase(page.updated_at)
        setRow(page)
        setInitial(start)
        if (push) saver.change(start)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  const mod = row?.modules
  return (
    <div className="shell page-shell">
      <TopBar
        crumbs={[
          { label: 'Notebooks', to: '/' },
          { label: mod?.notebooks.title ?? '…', to: mod ? `/n/${mod.notebooks.id}` : undefined },
          { label: mod?.title ?? '…', to: mod ? `/m/${mod.id}` : undefined },
        ]}
        right={<span className={`save-state save-${saver.state}`} aria-live="polite">{SAVE_LABEL[saver.state]}</span>}
      />
      <main className="content content-page">
        {initial ? <PageEditor key={pageId} initial={initial} onChange={saver.change} /> : <Status error={error} loading />}
      </main>
    </div>
  )
}
