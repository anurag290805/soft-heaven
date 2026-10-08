export function validateCommerceEnvironment(env, { mode = 'production', command = 'build' } = {}) {
  const errors = []
  const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_RAZORPAY_ENABLED', 'VITE_GOOGLE_SIGN_IN_ENABLED', 'VITE_COMMERCE_ENV'])
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && !allowed.has(name) && /SECRET|PRIVATE|SERVICE_ROLE|PASSWORD/i.test(name)) errors.push(`${name} must never be exposed through Vite.`)
  }
  const commerce = env.VITE_COMMERCE_ENV || 'disabled'
  if (!['disabled', 'test', 'live', 'qa'].includes(commerce)) errors.push('VITE_COMMERCE_ENV must be disabled, test, live, or qa.')
  const url = env.VITE_SUPABASE_URL || ''
  const key = env.VITE_SUPABASE_ANON_KEY || ''
  if (Boolean(url) !== Boolean(key)) errors.push('Configure both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  if (commerce === 'qa' && (mode !== 'qa' || command === 'build')) errors.push('QA fixture configuration is allowed only by the local QA dev server.')
  if (url) {
    try {
      const parsed = new URL(url)
      if (!['https:', 'http:'].includes(parsed.protocol)) errors.push('VITE_SUPABASE_URL is invalid.')
      if (commerce === 'live' && (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname))) errors.push('Live commerce requires an HTTPS Supabase endpoint.')
      if (/qa-store|edge-qa|example\.test/.test(parsed.hostname) && commerce !== 'qa') errors.push('A test fixture endpoint cannot be used by a deployable build.')
    } catch { errors.push('VITE_SUPABASE_URL is invalid.') }
  }
  if (key.startsWith('sb_secret_')) errors.push('VITE_SUPABASE_ANON_KEY contains a private Supabase key.')
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
      if (payload.role !== 'anon') errors.push('The browser Supabase JWT must have the anon role.')
    } catch { errors.push('VITE_SUPABASE_ANON_KEY is not a valid public key.') }
  } else if (key && !key.startsWith('sb_publishable_') && commerce !== 'qa') errors.push('Use a Supabase public anon or publishable key.')
  if (env.VITE_RAZORPAY_ENABLED === 'true' && (!url || !key || !['test', 'live', 'qa'].includes(commerce))) errors.push('Enabled payments require a configured Supabase endpoint and explicit commerce environment.')
  if (env.VITE_GOOGLE_SIGN_IN_ENABLED === 'true' && (!url || !key)) errors.push('Enabled Google sign-in requires Supabase configuration.')
  return errors
}
