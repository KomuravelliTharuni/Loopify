import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Leaf, Recycle, ShieldCheck } from 'lucide-react'
import type { AuthError } from '@supabase/supabase-js'

type AuthMode = 'login' | 'register'

export default function AuthScreen({
  configured,
  initialMode,
  onDemo,
  onLogin,
  onRegister,
}: {
  configured: boolean
  initialMode: AuthMode
  onDemo: () => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (input: { email: string; password: string; name: string; organization: string }) => Promise<void>
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (mode === 'login') {
        await onLogin(email, password)
      } else {
        await onRegister({ email, password, name, organization })
        setMessage('Account created. Check your email to confirm your address, then sign in.')
        setMode('login')
        setPassword('')
      }
    } catch (reason) {
      const authError = reason as AuthError
      setError(authError.message || 'We could not complete that request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const headingLabel = mode === 'login' ? 'WELCOME BACK' : 'JOIN THE CIRCLE'
  const heading = mode === 'login' ? 'Good to have you back.' : 'Let’s make room to reuse.'
  const description = mode === 'login' ? 'Sign in to your campus workspace.' : 'Create your Loopify account to get started.'

  return <main className="auth-page">
    <section className="auth-story">
      <a className="brand auth-brand" href="#"><span className="brand-mark"><Recycle size={21} strokeWidth={2.5} /></span><span className="brand-word">loopify<span>.</span></span></a>
      <div className="auth-story-copy"><div className="eyebrow"><span className="eyebrow-dot" /> YOUR CAMPUS, IN CIRCULATION</div><h1>Good things go <em>around.</em></h1><p>Find what your campus already has. Share a little more, buy a little less.</p><div className="auth-art"><span className="auth-orbit auth-orbit-one" /><span className="auth-orbit auth-orbit-two" /><div className="auth-board">THE<br />NEXT<br />THING</div><div className="auth-crate"><Recycle size={31} /></div><div className="auth-leaf"><Leaf size={21} /></div><span className="auth-star">✦</span></div><div className="auth-caption"><ShieldCheck size={15} /> Every shared item has another story.</div></div>
      <div className="auth-story-foot">A verified reuse system for college event materials.</div>
    </section>
    <section className="auth-form-side"><div className="auth-card">
      <div className="auth-mobile-brand"><span className="brand-mark"><Recycle size={19} /></span><span className="brand-word">loopify<span>.</span></span></div>
      <div className="auth-tabs"><button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); setMessage('') }}>Sign in</button><button className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); setMessage('') }}>Create account</button></div>
      <div className="auth-heading"><span>{headingLabel}</span><h2>{heading}</h2><p>{description}</p></div>
      <form className="auth-form" onSubmit={submit}>
        {!configured && <div className="auth-message auth-warning" role="status">Connect Supabase to enable real accounts. Add your project URL and publishable/anon key to .env.local, then restart the app.</div>}
        {mode === 'register' && <><label className="form-field">Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="e.g. Alex Morgan" required disabled={!configured} /></label><label className="form-field">Club or department<input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="e.g. Design Society" required disabled={!configured} /></label></>}
        <label className="form-field">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@campus.edu" required disabled={!configured} /></label>
        <label className="form-field">Password<span className="password-wrap"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} placeholder="At least 8 characters" required disabled={!configured} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} disabled={!configured}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
        {error && <div className="auth-message auth-error" role="alert">{error}</div>}
        {message && <div className="auth-message auth-success" role="status">{message}</div>}
        <button className="button button-primary auth-submit" type="submit" disabled={!configured || busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in to Loopify' : 'Create my account'} {!busy && <ArrowRight size={15} />}</button>
      </form>
      <div className="auth-divider"><span /> or <span /></div>
      <button className="button button-outline auth-demo" onClick={onDemo}><Leaf size={15} /> Explore the demo workspace</button>
      {configured && <p className="auth-terms"><ShieldCheck size={13} /> Your campus activity is shared only with signed-in workspace members.</p>}
    </div><div className="auth-footer">Loopify · Building a circular campus economy</div></section>
  </main>
}
