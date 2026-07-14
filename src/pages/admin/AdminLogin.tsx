import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'

export default function AdminLogin() {
  const { session, loading } = useAuth()
  const { show } = useToast()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  if (loading) return null
  if (session) return <Navigate to="/admin" replace />

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) show(error.message, 'error')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setSubmitting(false)
      show(error.message, 'error')
      return
    }
    if (data.user && displayName.trim()) {
      await supabase.from('profiles').upsert({ id: data.user.id, display_name: displayName.trim() })
    }
    setSubmitting(false)
    setSignupDone(true)
  }

  if (signupDone) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>✓</div>
          <h2 className="admin-login-title">Konto skapat</h2>
          <p className="admin-login-subtitle">
            Ditt konto är registrerat. En administratör behöver tilldela dig en roll innan du kan logga in på adminpanelen.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
            Om du är den första administratören: logga in i Supabase Dashboard och kör:<br />
            <code style={{ background: 'var(--bg-alt)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem' }}>
              INSERT INTO public.user_roles (user_id, role)<br />
              VALUES ('{'<din user-id>'}', 'superadmin');
            </code>
          </p>
          <button className="btn btn-primary" onClick={() => { setSignupDone(false); setMode('login') }}>
            Logga in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1 className="admin-login-title">Rögleskogen</h1>
        <p className="admin-login-subtitle">
          {mode === 'login' ? 'Logga in på adminpanelen' : 'Skapa administratörskonto'}
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          <button
            type="button"
            className={mode === 'login' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            style={{ flex: 1 }}
            onClick={() => setMode('login')}
          >
            Logga in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            style={{ flex: 1 }}
            onClick={() => setMode('signup')}
          >
            Skapa konto
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-postadress</label>
              <input
                id="email"
                className="form-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Lösenord</label>
              <input
                id="password"
                className="form-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-3)' }}
              disabled={submitting}
            >
              {submitting ? 'Loggar in…' : 'Logga in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label className="form-label" htmlFor="displayName">Ditt namn</label>
              <input
                id="displayName"
                className="form-input"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-postadress</label>
              <input
                id="email"
                className="form-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Lösenord (minst 8 tecken)</label>
              <input
                id="password"
                className="form-input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-3)' }}
              disabled={submitting}
            >
              {submitting ? 'Skapar konto…' : 'Skapa konto'}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
              Konton aktiveras av en superadministratör.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
