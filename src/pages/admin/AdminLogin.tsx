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

  return (
    <div className="admin-login-page">
      <div className="admin-login-split">
        <aside className="admin-login-brand">
          <div className="admin-login-brand-inner">
            <span className="admin-login-eyebrow">Medborgarinitiativ</span>
            <h1 className="admin-login-brand-title">Rögleskogen</h1>
            <p className="admin-login-brand-text">
              Tillsammans bevakar och dokumenterar vi planerna för den föreslagna bergtäkten
              mellan Södra Sandby och Dalby.
            </p>
            <ul className="admin-login-brand-list">
              <li>Samla information, dokument och vittnesmål</li>
              <li>Håll boende och beslutsfattare uppdaterade</li>
              <li>Sakligt och källhänvisat – alltid</li>
            </ul>
          </div>
          <p className="admin-login-brand-foot">Adminpanel · endast för behöriga</p>
        </aside>

        <div className="admin-login-panel">
          {signupDone ? (
            <div className="admin-login-card" style={{ textAlign: 'center' }}>
              <div className="admin-login-check" aria-hidden="true">✓</div>
              <h2 className="admin-login-title">Konto skapat</h2>
              <p className="admin-login-subtitle">
                Tack! Ditt konto är registrerat. En administratör behöver tilldela dig en roll
                innan du kommer in i adminpanelen.
              </p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setSignupDone(false); setMode('login') }}>
                Till inloggningen
              </button>
            </div>
          ) : (
            <div className="admin-login-card">
              <h2 className="admin-login-title">{mode === 'login' ? 'Välkommen tillbaka' : 'Skapa konto'}</h2>
              <p className="admin-login-subtitle">
                {mode === 'login' ? 'Logga in för att hantera webbplatsen.' : 'Registrera dig – en administratör aktiverar ditt konto.'}
              </p>

              <div className="admin-login-tabs">
                <button
                  type="button"
                  className={mode === 'login' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  onClick={() => setMode('login')}
                >
                  Logga in
                </button>
                <button
                  type="button"
                  className={mode === 'signup' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  onClick={() => setMode('signup')}
                >
                  Skapa konto
                </button>
              </div>

              {mode === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">E-postadress</label>
                    <input id="email" className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Lösenord</label>
                    <input id="password" className="form-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }} disabled={submitting}>
                    {submitting ? 'Loggar in…' : 'Logga in'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignup}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="displayName">Ditt namn</label>
                    <input id="displayName" className="form-input" type="text" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">E-postadress</label>
                    <input id="email" className="form-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="password">Lösenord (minst 8 tecken)</label>
                    <input id="password" className="form-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }} disabled={submitting}>
                    {submitting ? 'Skapar konto…' : 'Skapa konto'}
                  </button>
                  <p className="admin-login-hint">Konton aktiveras av en superadministratör.</p>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
