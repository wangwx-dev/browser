import { useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let disposed = false
    let authEventSeen = false

    const applySession = (nextSession: Session | null) => {
      if (disposed) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeen = true
      applySession(nextSession)
    })

    void supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        // An auth event is newer than the initial snapshot, even if the
        // getSession promise happens to settle afterward.
        if (!authEventSeen) applySession(initialSession)
      })
      .catch(() => {
        if (!authEventSeen) applySession(null)
      })

    return () => {
      disposed = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    if (!isSupabaseConfigured) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
