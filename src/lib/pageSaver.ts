import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { supabase } from './supabase'

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'offline'

export interface Snapshot {
  title: string
  icon: string | null
  banner_url: string | null
  content: JSONContent
}

// A local copy of every unsynced edit. It is only removed once the server confirms the save,
// so closing the app, losing signal or iOS killing the tab cannot lose what was typed.
export interface Draft extends Snapshot {
  base: string // server updated_at the edits were made on top of
  ts: number
}

const draftKey = (pageId: string) => `nb:draft:${pageId}`

export function readDraft(pageId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(pageId))
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

function writeDraft(pageId: string, draft: Draft) {
  try {
    localStorage.setItem(draftKey(pageId), JSON.stringify(draft))
  } catch {
    // Storage full or blocked: the server save still runs, we just lose the local safety net.
  }
}

export function clearDraft(pageId: string) {
  try {
    localStorage.removeItem(draftKey(pageId))
  } catch {
    /* ignore */
  }
}

export function derivePageMeta(content: JSONContent) {
  let text = ''
  let cover: string | null = null
  const walk = (node: JSONContent) => {
    if (text.length > 300 && cover) return
    if (node.type === 'image' && !cover && typeof node.attrs?.src === 'string') cover = node.attrs.src
    if (node.text && text.length <= 300) text += node.text
    if (node.content) {
      for (const child of node.content) walk(child)
      if (node.type !== 'doc' && text && !text.endsWith(' ')) text += ' '
    }
  }
  walk(content)
  return { preview_text: text.trim().slice(0, 300), cover_url: cover as string | null }
}

const SAVE_DELAY = 800

export function usePageSaver(pageId: string) {
  const [state, setState] = useState<SaveState>('saved')
  const pending = useRef<Snapshot | null>(null)
  const base = useRef('')
  const inFlight = useRef<Promise<void> | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const failures = useRef(0)

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current)
    if (inFlight.current) await inFlight.current
    const snap = pending.current
    if (!snap) return
    if (!navigator.onLine) {
      setState('offline')
      return
    }
    pending.current = null
    setState('saving')
    const run = (async () => {
      const meta = derivePageMeta(snap.content)
      const { data, error } = await supabase
        .from('pages')
        .update({ title: snap.title, icon: snap.icon, banner_url: snap.banner_url, content: snap.content, ...meta })
        .eq('id', pageId)
        .select('updated_at')
        .single()
      if (error || !data) {
        if (!pending.current) pending.current = snap
        failures.current += 1
        setState(navigator.onLine ? 'error' : 'offline')
        const delay = Math.min(30_000, 1000 * 2 ** failures.current)
        timer.current = window.setTimeout(() => void flush(), delay)
        return
      }
      failures.current = 0
      base.current = data.updated_at
      if (pending.current) {
        setState('unsaved')
        timer.current = window.setTimeout(() => void flush(), SAVE_DELAY)
      } else {
        clearDraft(pageId)
        setState('saved')
      }
    })()
    inFlight.current = run
    try {
      await run
    } finally {
      inFlight.current = null
    }
  }, [pageId])

  const change = useCallback(
    (snap: Snapshot) => {
      pending.current = snap
      writeDraft(pageId, { ...snap, base: base.current, ts: Date.now() })
      setState((s) => (s === 'saving' ? s : navigator.onLine ? 'unsaved' : 'offline'))
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY)
    },
    [pageId, flush],
  )

  const setBase = useCallback((updatedAt: string) => {
    base.current = updatedAt
  }, [])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onOnline = () => void flush()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current || inFlight.current) {
        void flush()
        e.preventDefault()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onOnline)
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onOnline)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onBeforeUnload)
      // Leaving the page inside the app: push whatever is left.
      void flush()
    }
  }, [flush])

  return { state, change, flush, setBase }
}
