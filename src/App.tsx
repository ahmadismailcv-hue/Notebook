import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { DialogProvider } from './components/Dialog'
import { HomeView } from './views/HomeView'
import { NotebookView } from './views/NotebookView'
import { ModuleView } from './views/ModuleView'

// The editor is the heavy part of the bundle; load it only when a page is opened.
const PageView = lazy(() => import('./views/PageView').then((m) => ({ default: m.PageView })))

function Routed() {
  const { session, loading } = useAuth()
  // Warm the editor chunk in the background so opening a page feels instant.
  useEffect(() => {
    if (session) setTimeout(() => void import('./views/PageView'), 1500)
  }, [session])
  if (loading) return <div className="splash" />
  if (!session) return <LoginPage />
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/n/:notebookId" element={<NotebookView />} />
      <Route path="/m/:moduleId" element={<ModuleView />} />
      <Route
        path="/p/:pageId"
        element={
          <Suspense fallback={<div className="splash" />}>
            <PageView />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Hash routing: GitHub Pages serves static files only, so deep links must not hit the server.
export default function App() {
  return (
    <AuthProvider>
      <DialogProvider>
        <HashRouter>
          <Routed />
        </HashRouter>
      </DialogProvider>
    </AuthProvider>
  )
}
