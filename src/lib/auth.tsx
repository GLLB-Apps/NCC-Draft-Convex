import React, { createContext, useContext } from 'react'
import { useConvexAuth, useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { api } from '../../convex/_generated/api'
import type { UserRole } from './types'

// Byggd direkt mot Convex Auths egna, riktigt reaktiva hooks (useConvexAuth/
// useAuthActions) istället för shimmens pub/sub-emitter — Convex Auths
// sessionstillstånd är redan en enda källa till sanning som uppdateras
// automatiskt, så den manuella emit()-mekanismen i den gamla supabase.ts
// behövs inte längre. useAuth()-kontraktet nedan är dock BYTE-FÖR-BYTE
// identiskt med originalet — se MIGRATION_PLAN.md §4.
export type User = { id: string; email: string }
export type Session = { user: User }

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: UserRole | null
  displayName: string | null
  isAdmin: boolean
  isMember: boolean
  canWriteIntranet: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions()
  const me = useQuery(api.users.me, isAuthenticated ? {} : 'skip')

  // Samma spinner-logik som originalet: sessionen ska inte synas förrän
  // rollen/medlemskapet hunnit laddas, annars dömer guarderna på role===null
  // ett ögonblick för tidigt.
  const loading = authLoading || (isAuthenticated && me === undefined)

  const user: User | null = me ? { id: me.id, email: me.email } : null
  const session: Session | null = user ? { user } : null
  const role = (me?.role ?? null) as UserRole | null
  const displayName = me?.displayName ?? null
  const isAdmin = me?.isAdmin ?? false
  const isMember = me?.isMember ?? false
  const canWriteIntranet = me?.canWriteIntranet ?? false

  async function signIn(email: string, password: string) {
    try {
      await convexSignIn('password', { email, password, flow: 'signIn' })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Kunde inte logga in.' }
    }
  }

  async function signOut() {
    await convexSignOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, role, displayName, isAdmin, isMember, canWriteIntranet, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
