import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps)
  const reload = useCallback(async () => {
    try {
      setData(await load())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [load])
  useEffect(() => {
    setData(null)
    void reload()
  }, [reload])
  return { data, error, reload, setData }
}

export function must<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<T>
}

// Run a user action; surface failures instead of swallowing them.
export async function safely(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (e) {
    alert(`Something went wrong: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export type Crumb = { label: string; to?: string }

export function TopBar({ crumbs, right }: { crumbs: Crumb[]; right?: ReactNode }) {
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="crumb">
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span className="crumb-current">{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="topbar-right">{right}</div>
    </header>
  )
}

export function SignOutButton() {
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => void supabase.auth.signOut()}>
      Sign out
    </button>
  )
}

export function MoreButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      className="more-btn"
      aria-label={`Options for ${label}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="2" fill="currentColor" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="19" cy="12" r="2" fill="currentColor" />
      </svg>
    </button>
  )
}

export function Collage({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null
  const shown = urls.slice(0, 3)
  return (
    <div className={`collage collage-${shown.length}`}>
      {shown.map((u) => (
        <img key={u} src={u} alt="" loading="lazy" />
      ))}
    </div>
  )
}

export function Status({ error, loading, empty }: { error: string | null; loading: boolean; empty?: ReactNode }) {
  if (error) return <p className="status error">Couldn’t load: {error}</p>
  if (loading) return <p className="status">Loading…</p>
  return empty ? <div className="status empty">{empty}</div> : null
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
