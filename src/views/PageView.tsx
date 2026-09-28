import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import { DEFAULT_ICON, type Page } from '../lib/types'
import { clearDraft, derivePageMeta, readDraft, usePageSaver, type SaveState, type Snapshot } from '../lib/pageSaver'
import { useDialog } from '../components/Dialog'
import { TopBar } from '../components/Layout'
import { displayTitle, useItemActions } from '../components/actions'
import { Icon } from '../components/icons'
import { PageEditor } from '../editor/PageEditor'

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Editing',
  error: 'Save failed – retrying',
  offline: 'Offline – kept on this device',
}

const same = (a: Snapshot, b: Snapshot) =>
  a.title === b.title && a.icon === b.icon && a.banner_url === b.banner_url && JSON.stringify(a.content) === JSON.stringify(b.content)

export function PageView() {
  const { pageId = '' } = useParams()
  const ws = useWorkspace()
  const dialog = useDialog()
  const actions = useItemActions()
  const saver = usePageSaver(pageId)
  const [initial, setInitial] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setInitial(null)
    setError(null)
    ;(async () => {
      try {
        const res = await supabase.from('pages').select('*').eq('id', pageId).single()
        if (res.error) throw new Error(res.error.message)
        const page = res.data as Page
        if (cancelled) return
        const server: Snapshot = { title: page.title, icon: page.icon, banner_url: page.banner_url, content: page.content }
        let start = server
        let push = false
        const draft = readDraft(pageId)
        if (draft) {
          const local: Snapshot = { title: draft.title, icon: draft.icon ?? server.icon, banner_url: draft.banner_url ?? server.banner_url, content: draft.content }
          if (same(local, server)) clearDraft(pageId)
          else if (!draft.base || draft.base === page.updated_at) {
            start = local
            push = true
          } else {
            const keepLocal = await dialog.confirm(
              'Unsynced changes found',
              `This device has edits from ${new Date(draft.ts).toLocaleString()} that were never saved, but the page was changed elsewhere since. Keep this device’s version? Choosing Cancel keeps the version from the cloud and discards the local edits.`,
              { okLabel: 'Keep this device’s version' },
            )
            if (keepLocal) {
              start = local
              push = true
            } else clearDraft(pageId)
          }
        }
        if (cancelled) return
        saver.setBase(page.updated_at)
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

  const { change } = saver
  const { patchPageLocal } = ws
  const lastMeta = useRef('')
  const onChange = useCallback(
    (snap: Snapshot) => {
      change(snap)
      // Keep the sidebar and cards in step, but only re-render them when something they show changed.
      const next = { title: snap.title, icon: snap.icon, banner_url: snap.banner_url, cover_url: derivePageMeta(snap.content).cover_url }
      const key = JSON.stringify(next)
      if (key !== lastMeta.current) {
        lastMeta.current = key
        patchPageLocal(pageId, next)
      }
    },
    [change, patchPageLocal, pageId],
  )

  const p = ws.findPage(pageId)
  return (
    <>
      <TopBar
        crumbs={
          p
            ? [
                { label: displayTitle(p.notebook.title), icon: p.notebook.icon ?? DEFAULT_ICON.notebook, to: `/n/${p.notebook.id}` },
                { label: displayTitle(p.module.title), icon: p.module.icon ?? DEFAULT_ICON.module, to: `/m/${p.module.id}` },
                { label: displayTitle(p.title), icon: p.icon ?? DEFAULT_ICON.page },
              ]
            : []
        }
        right={
          <>
            <span className={`save-state save-${saver.state}`} aria-live="polite">
              {SAVE_LABEL[saver.state]}
            </span>
            {p && (
              <button className="icon-btn" aria-label="Page options" onClick={(e) => actions.pageMenu(e.currentTarget, pageId)}>
                <Icon name="more" />
              </button>
            )}
          </>
        }
      />
      <main className="page-main">
        {initial ? (
          <PageEditor key={pageId} initial={initial} onChange={onChange} />
        ) : (
          <div className="doc">
            <p className={`status ${error ? 'error' : ''}`}>{error ? `Couldn’t load this page: ${error}` : 'Loading…'}</p>
          </div>
        )}
      </main>
    </>
  )
}
