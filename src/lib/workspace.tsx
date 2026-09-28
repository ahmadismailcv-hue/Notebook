import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { NOTEBOOK_COLORS, type Module, type Notebook } from './types'

export interface TreePage {
  id: string
  module_id: string
  title: string
  icon: string | null
  cover_url: string | null
  banner_url: string | null
  position: number
}
export type TreeModule = Module & { pages: TreePage[] }
export type TreeNotebook = Notebook & { modules: TreeModule[] }

function must<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<T>
}

interface Workspace {
  tree: TreeNotebook[] | null
  error: string | null
  reload: () => Promise<void>
  findNotebook: (id: string) => TreeNotebook | undefined
  findModule: (id: string) => (TreeModule & { notebook: TreeNotebook }) | undefined
  findPage: (id: string) => (TreePage & { module: TreeModule; notebook: TreeNotebook }) | undefined
  createNotebook: () => Promise<string>
  createModule: (notebookId: string) => Promise<string>
  createPage: (moduleId: string) => Promise<string>
  updateNotebook: (id: string, patch: Partial<Pick<Notebook, 'title' | 'icon' | 'color'>>) => Promise<void>
  updateModule: (id: string, patch: Partial<Pick<Module, 'title' | 'icon'>>) => Promise<void>
  /** Local-only update, used while the page editor saves through its own queue. */
  patchPageLocal: (id: string, patch: Partial<TreePage>) => void
  deleteNotebook: (id: string) => Promise<void>
  deleteModule: (id: string) => Promise<void>
  deletePage: (id: string) => Promise<void>
}

const Ctx = createContext<Workspace | null>(null)

export function useWorkspace() {
  const ws = useContext(Ctx)
  if (!ws) throw new Error('useWorkspace outside WorkspaceProvider')
  return ws
}

const mapModules = (tree: TreeNotebook[], fn: (m: TreeModule) => TreeModule) =>
  tree.map((n) => ({ ...n, modules: n.modules.map(fn) }))

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tree, setTree] = useState<TreeNotebook[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const data = must(
        await supabase
          .from('notebooks')
          .select('*, modules(*, pages(id, module_id, title, icon, cover_url, banner_url, position))')
          .order('position')
          .order('position', { referencedTable: 'modules' })
          .order('position', { referencedTable: 'modules.pages' }),
      ) as TreeNotebook[]
      setTree(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const ws = useMemo<Workspace>(() => {
    const t = tree ?? []
    return {
      tree,
      error,
      reload,
      findNotebook: (id) => t.find((n) => n.id === id),
      findModule: (id) => {
        for (const n of t) for (const m of n.modules) if (m.id === id) return { ...m, notebook: n }
      },
      findPage: (id) => {
        for (const n of t) for (const m of n.modules) for (const p of m.pages) if (p.id === id) return { ...p, module: m, notebook: n }
      },
      createNotebook: async () => {
        const color = NOTEBOOK_COLORS[Math.floor(Math.random() * (NOTEBOOK_COLORS.length - 1))]
        const nb = must(await supabase.from('notebooks').insert({ title: '', color }).select('*').single()) as Notebook
        setTree((cur) => [...(cur ?? []), { ...nb, modules: [] }])
        return nb.id
      },
      createModule: async (notebookId) => {
        const m = must(await supabase.from('modules').insert({ title: '', notebook_id: notebookId }).select('*').single()) as Module
        setTree((cur) => (cur ?? []).map((n) => (n.id === notebookId ? { ...n, modules: [...n.modules, { ...m, pages: [] }] } : n)))
        return m.id
      },
      createPage: async (moduleId) => {
        const p = must(
          await supabase.from('pages').insert({ module_id: moduleId }).select('id, module_id, title, icon, cover_url, banner_url, position').single(),
        ) as TreePage
        setTree((cur) => mapModules(cur ?? [], (m) => (m.id === moduleId ? { ...m, pages: [...m.pages, p] } : m)))
        return p.id
      },
      updateNotebook: async (id, patch) => {
        setTree((cur) => (cur ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n)))
        must(await supabase.from('notebooks').update(patch).eq('id', id))
      },
      updateModule: async (id, patch) => {
        setTree((cur) => mapModules(cur ?? [], (m) => (m.id === id ? { ...m, ...patch } : m)))
        must(await supabase.from('modules').update(patch).eq('id', id))
      },
      patchPageLocal: (id, patch) =>
        setTree((cur) =>
          cur ? mapModules(cur, (m) => (m.pages.some((p) => p.id === id) ? { ...m, pages: m.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : m)) : cur,
        ),
      deleteNotebook: async (id) => {
        must(await supabase.from('notebooks').delete().eq('id', id))
        setTree((cur) => (cur ?? []).filter((n) => n.id !== id))
      },
      deleteModule: async (id) => {
        must(await supabase.from('modules').delete().eq('id', id))
        setTree((cur) => (cur ?? []).map((n) => ({ ...n, modules: n.modules.filter((m) => m.id !== id) })))
      },
      deletePage: async (id) => {
        must(await supabase.from('pages').delete().eq('id', id))
        setTree((cur) => mapModules(cur ?? [], (m) => ({ ...m, pages: m.pages.filter((p) => p.id !== id) })))
      },
    }
  }, [tree, error, reload])

  return <Ctx.Provider value={ws}>{children}</Ctx.Provider>
}
