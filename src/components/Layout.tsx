import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Icon } from './icons'

interface LayoutApi {
  sidebarOpen: boolean
  isPhone: boolean
  toggleSidebar: () => void
  closeSidebarOnPhone: () => void
}
const Ctx = createContext<LayoutApi>({ sidebarOpen: true, isPhone: false, toggleSidebar: () => {}, closeSidebarOnPhone: () => {} })
export const useLayout = () => useContext(Ctx)

const phoneQuery = '(max-width: 760px)'

export function AppLayout() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(phoneQuery).matches)
  const [desktopOpen, setDesktopOpen] = useState(() => {
    try {
      return localStorage.getItem('nb:sidebar') !== 'closed'
    } catch {
      return true
    }
  })
  const [phoneOpen, setPhoneOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const mq = window.matchMedia(phoneQuery)
    const on = () => setIsPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Navigating on a phone closes the drawer.
  useEffect(() => setPhoneOpen(false), [location.pathname])

  const toggleSidebar = useCallback(() => {
    if (isPhone) setPhoneOpen((o) => !o)
    else
      setDesktopOpen((o) => {
        try {
          localStorage.setItem('nb:sidebar', o ? 'closed' : 'open')
        } catch {
          /* ignore */
        }
        return !o
      })
  }, [isPhone])

  const sidebarOpen = isPhone ? phoneOpen : desktopOpen
  const api: LayoutApi = { sidebarOpen, isPhone, toggleSidebar, closeSidebarOnPhone: () => setPhoneOpen(false) }

  return (
    <Ctx.Provider value={api}>
      <div className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isPhone ? 'is-phone' : ''}`}>
        <Sidebar />
        {isPhone && sidebarOpen && <div className="drawer-backdrop" onClick={() => setPhoneOpen(false)} />}
        <div className="main">
          <Outlet />
        </div>
      </div>
    </Ctx.Provider>
  )
}

export type Crumb = { label: string; icon?: string | null; to?: string }

export function TopBar({ crumbs, right }: { crumbs: Crumb[]; right?: ReactNode }) {
  const { sidebarOpen, isPhone, toggleSidebar } = useLayout()
  return (
    <header className="topbar">
      {(!sidebarOpen || isPhone) && (
        <button className="icon-btn" onClick={toggleSidebar} aria-label="Open sidebar">
          <Icon name="menu" />
        </button>
      )}
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} className="crumb">
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.to ? (
              <Link to={c.to} className="crumb-link">
                {c.icon && <span className="crumb-icon">{c.icon}</span>}
                <span className="crumb-text">{c.label}</span>
              </Link>
            ) : (
              <span className="crumb-link current">
                {c.icon && <span className="crumb-icon">{c.icon}</span>}
                <span className="crumb-text">{c.label}</span>
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className="topbar-right">{right}</div>
    </header>
  )
}
