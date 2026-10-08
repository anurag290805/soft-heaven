import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { StorefrontPage } from './StorefrontPage'
import { commerceConfiguration, getCurrentSession, getSafeRedirect, registerAccount, requestPasswordReset, signIn, signInWithGoogle, updatePassword } from '../data/commerce'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

export function AuthPage({ mode }: { mode: AuthMode }) {
  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetAllowed, setResetAllowed] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (mode !== 'reset') return
    let active = true
    const parameters = new URLSearchParams(window.location.hash.slice(1))
    if (parameters.has('error') || new URLSearchParams(window.location.search).has('error')) {
      queueMicrotask(() => { if (active) { setStatus('This recovery link is invalid or expired. Request a new reset link.'); setHasError(true) } })
      return () => { active = false }
    }
    void getCurrentSession().then((result) => {
      if (!active) return
      setResetAllowed(result.ok)
      if (!result.ok) { setStatus('Open the password reset link from your email, or request a new link.'); setHasError(true) }
    })
    return () => { active = false }
  }, [mode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || (isReset && !resetAllowed)) return
    setStatus(null)
    setHasError(false)
    if ((isRegister || isReset) && password !== passwordConfirmation) { setStatus('The passwords do not match. Please enter them again.'); setHasError(true); return }
    setIsSubmitting(true)
    if (isRegister) {
      const registered = await registerAccount(name.trim(), email.trim(), password)
      setIsSubmitting(false)
      if (!registered.ok) { setStatus(registered.message); setHasError(true); return }
      setPassword('')
      setPasswordConfirmation('')
      if (registered.data.needsConfirmation) {
        setStatus('Check your email to confirm your account. If you already have an account, sign in or request a password reset.')
        return
      }
      window.location.href = getSafeRedirect()
      return
    }
    const result = isForgot
      ? await requestPasswordReset(email.trim())
      : isReset
        ? await updatePassword(password)
        : await signIn(email.trim(), password)
    setIsSubmitting(false)
    if (!result.ok) {
      setStatus(result.message)
      setHasError(true)
      return
    }
    if (isForgot) {
      setStatus('If an account uses this email, a password reset link is on its way.')
      return
    }
    window.location.href = getSafeRedirect()
  }

  async function handleGoogle() {
    setStatus(null)
    setIsSubmitting(true)
    const result = await signInWithGoogle()
    if (!result.ok) { setStatus(result.message); setHasError(true); setIsSubmitting(false) }
  }

  const redirectQuery = `?redirect=${encodeURIComponent(getSafeRedirect())}`
  const title = isReset ? 'Choose a new password' : isForgot ? 'Reset your password' : isRegister ? 'Create your Soft Heaven account' : 'Welcome back'
  const introduction = isReset ? 'Save a new password for your authenticated account.' : isForgot ? 'Request a secure password reset link from Supabase Auth.' : isRegister ? 'Save your details, keep your wishlist across devices, and follow orders from one place.' : 'Sign in to continue to checkout, view orders, and keep your selections connected.'

  return (
    <StorefrontPage title={title} eyebrow={isForgot ? 'ACCOUNT RECOVERY' : isRegister ? 'YOUR SOFT HEAVEN ACCOUNT' : 'SIGN IN SECURELY'} introduction={introduction}>
      <div className="auth-layout">
        <section className="auth-card" aria-labelledby="auth-form-title">
          <div className="auth-card__header"><span className="auth-card__icon"><LockKeyhole aria-hidden="true" size={18} strokeWidth={1.5} /></span><div><h2 id="auth-form-title">{isReset ? 'Choose your new password.' : isForgot ? 'Request a reset link.' : isRegister ? 'A little easier, every time.' : 'Continue where you left off.'}</h2></div></div>
          <form className="commerce-form" onSubmit={handleSubmit}>
            {isRegister && <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
            {!isReset && <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
            {!isForgot && <label>Password<input required minLength={isRegister || isReset ? 8 : 1} type="password" autoComplete={isRegister || isReset ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />{(isRegister || isReset) && <small>Use at least 8 characters.</small>}</label>}
            {(isRegister || isReset) && <label>Confirm password<input required type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label>}
            <button className="button button--dark" type="submit" disabled={isSubmitting || !commerceConfiguration.apiConfigured || (isReset && !resetAllowed)}>{isSubmitting ? 'Connecting…' : isReset ? 'Save new password' : isForgot ? 'Send reset link' : isRegister ? 'Create account' : 'Sign in'}<ArrowRight aria-hidden="true" size={16} strokeWidth={1.7} /></button>
          </form>
          {!isForgot && !isReset && commerceConfiguration.googleSignInConfigured && <button className="button button--soft auth-google" type="button" disabled={isSubmitting} onClick={handleGoogle}>Continue with Google</button>}
          {!isForgot && !isReset && !commerceConfiguration.googleSignInConfigured && <p className="auth-provider-note">Google sign-in is not enabled for this store.</p>}
          {status && <p className={`commerce-status${hasError ? ' commerce-status--error' : ''}`} role={hasError ? 'alert' : 'status'}>{status}</p>}
          {!commerceConfiguration.apiConfigured && <p className="commerce-status" role="status">Account services will be enabled when Supabase is configured. No password is stored in this browser.</p>}
          {!isRegister && !isForgot && <a className="auth-recovery-link" href="/forgot-password">{isReset ? 'Request a new reset link' : 'Forgot your password?'}</a>}
        </section>
        <aside className="commerce-aside"><p className="eyebrow">{isForgot || isReset ? 'BACK TO YOUR ACCOUNT' : 'WHY SIGN IN'}</p><h2>{isForgot || isReset ? 'Your account details stay yours.' : 'Keep the thoughtful bits together.'}</h2>{!isForgot && !isReset && <ul className="commerce-list"><li>Sync your wishlist between devices.</li><li>Save delivery details securely.</li><li>See confirmed orders and payment status.</li></ul>}<p className="commerce-aside__switch">{isForgot || isReset ? 'Return to your account.' : isRegister ? 'Already have an account?' : 'New to Soft Heaven?'}</p><ButtonLink href={(isForgot || isReset || isRegister ? '/login' : '/register') + redirectQuery} variant="text" icon="up-right">{isForgot || isReset || isRegister ? 'Sign in' : 'Create an account'}</ButtonLink></aside>
      </div>
    </StorefrontPage>
  )
}
