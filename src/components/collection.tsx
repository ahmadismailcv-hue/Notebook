import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { bannerStyle } from '../lib/types'
import { Icon } from './icons'

/** Notion-style editable heading: saves shortly after typing stops. */
export function InlineTitle({ value, onSave, placeholder = 'Untitled', autoFocus }: { value: string; onSave: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  const pending = useRef<string | null>(null)

  useEffect(() => {
    if (pending.current == null) setText(value)
  }, [value])

  const flush = () => {
    window.clearTimeout(timer.current)
    if (pending.current != null) {
      saveRef.current(pending.current)
      pending.current = null
    }
  }
  useEffect(() => flush, [])

  return (
    <input
      className="collection-title"
      value={text}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label="Title"
      onChange={(e) => {
        setText(e.target.value)
        pending.current = e.target.value
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(flush, 500)
      }}
      onBlur={flush}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

export function IconButton({ icon, onPick }: { icon: string; onPick: (anchor: HTMLElement) => void }) {
  return (
    <button className="collection-icon" onClick={(e) => onPick(e.currentTarget)} aria-label="Change icon">
      {icon}
    </button>
  )
}

interface CardProps {
  to: string
  icon: string
  title: string
  cover?: { image?: string | null; banner?: string | null; color?: string; collage?: string[] }
  meta?: ReactNode
  preview?: string
  onMore: (anchor: HTMLElement) => void
}

export function GalleryCard({ to, icon, title, cover, meta, preview, onMore }: CardProps) {
  let coverEl: ReactNode = null
  if (cover) {
    const collage = cover.collage?.filter(Boolean).slice(0, 3) ?? []
    const style: CSSProperties = cover.banner ? bannerStyle(cover.banner) : { background: cover.color ?? 'var(--bg-soft)' }
    coverEl = (
      <div className="gcard-cover" style={cover.image || collage.length ? undefined : style}>
        {cover.image ? (
          <img src={cover.image} alt="" loading="lazy" />
        ) : collage.length ? (
          <div className={`collage collage-${collage.length}`}>
            {collage.map((u) => (
              <img key={u} src={u} alt="" loading="lazy" />
            ))}
          </div>
        ) : !cover.banner ? (
          <span className="gcard-cover-icon">{icon}</span>
        ) : null}
      </div>
    )
  }
  return (
    <Link to={to} className="gcard">
      {coverEl}
      <div className="gcard-body">
        <div className="gcard-title">
          <span className="gcard-icon">{icon}</span>
          <span className={title ? '' : 'untitled'}>{title || 'Untitled'}</span>
        </div>
        {preview && <p className="gcard-preview">{preview}</p>}
        {meta && <div className="gcard-meta">{meta}</div>}
      </div>
      <button
        className="gcard-more"
        aria-label={`Options for ${title || 'Untitled'}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onMore(e.currentTarget)
        }}
      >
        <Icon name="more" size={16} />
      </button>
    </Link>
  )
}

export function NewCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="gcard gcard-new" onClick={onClick}>
      <Icon name="plus" size={16} />
      <span>{label}</span>
    </button>
  )
}

export const formatDate = (iso: string) => {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}
