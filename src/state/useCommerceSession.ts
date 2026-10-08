import { useEffect, useState } from 'react'
import { getCurrentSession, onAuthStateChange, type AuthUser } from '../data/commerce'

/** Server-validated identity; discard in-flight results when the account changes. */
export function useCommerceSession() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checked, setChecked] = useState(false)
  const [message, setMessage] = useState('Checking your account…')
  useEffect(() => {
    let active = true
    let revision = 0
    let identity: string | null | undefined
    async function load() {
      const request = ++revision
      const result = await getCurrentSession()
      if (!active || request !== revision) return
      identity = result.ok ? result.data.id : null
      setUser(result.ok ? result.data : null)
      setMessage(result.ok ? '' : result.message)
      setChecked(true)
    }
    void load()
    const unsubscribe = onAuthStateChange((next) => {
      if (!active) return
      if (identity === (next?.id ?? null)) {
        if (next) setUser((current) => current && current.name === next.name && current.email === next.email ? current : next)
        return
      }
      identity = next?.id ?? null
      setUser(null)
      setChecked(false)
      if (next) void load()
      else { revision++; setChecked(true); setMessage('You have been signed out. Sign in to continue with your Soft Heaven account.') }
    })
    return () => { active = false; revision++; unsubscribe?.() }
  }, [])
  return { user, checked, message }
}
