import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { computePosition, flip, offset, shift, type Placement } from '@floating-ui/dom'

type Render = (close: () => void) => ReactNode
interface Open {
  id: number
  anchor: HTMLElement
  render: Render
  placement: Placement
}
interface PopoverApi {
  open: (anchor: HTMLElement, render: Render, placement?: Placement) => void
  close: () => void
}

const Ctx = createContext<PopoverApi | null>(null)

export function usePopover() {
  const api = useContext(Ctx)
  if (!api) throw new Error('usePopover outside PopoverProvider')
  return api
}

const isPhone = () => window.matchMedia('(max-width: 640px)').matches

export function PopoverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Open | null>(null)
  const close = useCallback(() => setState(null), [])
  const open = useCallback<PopoverApi['open']>((anchor, render, placement = 'bottom-start') => setState({ id: Date.now(), anchor, render, placement }), [])
  const [api] = useState<PopoverApi>(() => ({ open, close }))
  return (
    <Ctx.Provider value={api}>
      {children}
      {state && <Floating key={state.id} state={state} close={close} />}
    </Ctx.Provider>
  )
}

function Floating({ state, close }: { state: Open; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [sheet] = useState(isPhone)

  useLayoutEffect(() => {
    if (sheet || !ref.current) return
    const el = ref.current
    void computePosition(state.anchor, el, {
      placement: state.placement,
      strategy: 'fixed',
      middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.visibility = 'visible'
    })
  }, [state, sheet])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !state.anchor.contains(t)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [close, state.anchor])

  if (sheet)
    return createPortal(
      <div className="sheet-backdrop">
        <div ref={ref} className="sheet" role="dialog">
          <div className="sheet-grabber" />
          {state.render(close)}
        </div>
      </div>,
      document.body,
    )
  return createPortal(
    <div ref={ref} className="popover" style={{ position: 'fixed', visibility: 'hidden', left: 0, top: 0 }} role="dialog">
      {state.render(close)}
    </div>,
    document.body,
  )
}

export interface MenuItem {
  label: string
  icon?: ReactNode
  hint?: string
  danger?: boolean
  onSelect: () => void
}

export function Menu({ items, close, title }: { items: (MenuItem | 'divider')[]; close: () => void; title?: string }) {
  return (
    <div className="menu" role="menu">
      {title && <div className="menu-title">{title}</div>}
      {items.map((it, i) =>
        it === 'divider' ? (
          <div key={i} className="menu-divider" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`menu-item ${it.danger ? 'danger' : ''}`}
            onClick={() => {
              close()
              it.onSelect()
            }}
          >
            {it.icon && <span className="menu-icon">{it.icon}</span>}
            <span className="menu-label">{it.label}</span>
            {it.hint && <span className="menu-hint">{it.hint}</span>}
          </button>
        ),
      )}
    </div>
  )
}
