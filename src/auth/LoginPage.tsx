import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EMAIL_KEY = 'nb:email'

// Single-user app: sign in once per device; the session then renews itself indefinitely.
export function LoginPage() {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    else
      try {
        localStorage.setItem(EMAIL_KEY, email)
      } catch {
        /* ignore */
      }
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="./icon.svg" alt="" width={56} height={56} />
        <h1>Notebook</h1>
        <p className="muted">Sign in once on this device. You’ll stay signed in.</p>
        <input className="input" type="email" autoComplete="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          required
          autoFocus={!!email}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  )
}
