import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage({ text: error.message, error: true })
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage({ text: error.message, error: true })
      else if (!data.session) {
        setMessage({ text: 'Check your email and tap the confirmation link, then come back here and sign in.' })
        setMode('signin')
      }
    }
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="./icon.svg" alt="" width={56} height={56} />
        <h1>Notebook</h1>
        <p className="muted">{mode === 'signin' ? 'Sign in to your notes' : 'Create your account'}</p>
        <input className="input" type="email" autoComplete="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder="Password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        {message && <p className={message.error ? 'form-error' : 'form-note'}>{message.text}</p>}
        <button type="button" className="link-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
