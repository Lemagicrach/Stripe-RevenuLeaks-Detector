'use client'
import React, { useEffect, useMemo } from 'react'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { getBrowserSupabaseClient } from '@/lib/supabase/client'

export function Providers({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') {
      return
    }

    const stopWhenOffline = () => {
      if (!navigator.onLine) {
        supabase.auth.stopAutoRefresh()
      }
    }

    const startWhenOnline = () => {
      if (navigator.onLine) {
        void supabase.auth.startAutoRefresh()
      }
    }

    stopWhenOffline()
    window.addEventListener('offline', stopWhenOffline)
    window.addEventListener('online', startWhenOnline)

    return () => {
      window.removeEventListener('offline', stopWhenOffline)
      window.removeEventListener('online', startWhenOnline)
    }
  }, [supabase])

  if (!supabase) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'Supabase client not initialized: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.'
      )
    }
    return <>{children}</>
  }

  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  )
}
