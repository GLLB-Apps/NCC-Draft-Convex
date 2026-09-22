import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'

// Sista steget i "glömt lösenord"-flödet — nås via länken Appwrite mejlar när
// AdminLogin.tsx (forgot-läget) anropar account.createRecovery. Appwrite
// lägger själv till ?userId=...&secret=... på redirect-URL:en, så de här
// parametrarna kommer inte från en inloggad session — sidan kräver medvetet
// ingen inloggning.
export default function AdminResetPassword() {
  const [params] = useSearchParams()
  const userId = params.get('userId') ?? ''
  const secret = params.get('secret') ?? ''
  const { show } = useToast()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (userId === '' || secret === '') {
    return (
      <div className="admin-login-page">
        <div className="admin-login-split">
          <div className="admin-login-panel" style={{ margin: '0 auto' }}>
            <div className="admin-login-card" style={{ textAlign: 'center' }}>
              <h2 className="admin-login-title">Ogiltig länk</h2>
              <p className="admin-login-subtitle">
                Länken saknar en återställningskod. Begär en ny länk från inloggningssidan.
              </p>
              <Link className="btn btn-primary" style={{ width: '100%' }} to="/admin/login">
                Till inloggningen
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    if (password !== confirm) { show('Lösenorden matchar inte', 'error'); return }

    setSubmitting(true)
    const { error } = await supabase.auth.updateRecovery({ userId, secret, password })
    setSubmitting(false)
    if (error) { show(error.message, 'error'); return }
    setDone(true)
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-split">
        <div className="admin-login-panel" style={{ margin: '0 auto' }}>
          {done ? (
            <div className="admin-login-card" style={{ textAlign: 'center' }}>
              <div className="admin-login-check" aria-hidden="true">✓</div>
              <h2 className="admin-login-title">Lösenordet är återställt</h2>
              <p className="admin-login-subtitle">
                Alla tidigare sessioner för kontot har loggats ut. Logga in med det nya lösenordet.
              </p>
              <Link className="btn btn-primary" style={{ width: '100%' }} to="/admin/login">
                Till inloggningen
              </Link>
            </div>
          ) : (
            <div className="admin-login-card">
              <h2 className="admin-login-title">Sätt nytt lösenord</h2>
              <p className="admin-login-subtitle">Länken gäller en begränsad tid och kan bara användas en gång.</p>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="password">Nytt lösenord (minst 8 tecken)</label>
                  <input
                    id="password" className="form-input"
                    type="password" autoComplete="new-password"
                    minLength={8} value={password} onChange={e => setPassword(e.target.value)} required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirm">Upprepa lösenordet</label>
                  <input
                    id="confirm" className="form-input"
                    type="password" autoComplete="new-password"
                    minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-3)' }} disabled={submitting}>
                  {submitting ? 'Sparar…' : 'Sätt nytt lösenord'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
