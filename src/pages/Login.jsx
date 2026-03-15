import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [mode, setMode]         = useState('signin') // 'signin' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setDone(true)
    }
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}><span style={{ color: 'var(--amber)' }}>▪</span> BLACKBOOK</div>
        <p style={s.sub}>Personal finance. No noise.</p>

        {done ? (
          <div style={s.doneBox}>
            <div style={s.doneTitle}>Check your email</div>
            <div style={s.doneSub}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account then come back to sign in.</div>
            <button style={{ ...s.btn, marginTop: '20px' }} onClick={() => { setMode('signin'); setDone(false) }}>
              BACK TO SIGN IN
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <Field label="EMAIL"    type="email"    value={email}    onChange={setEmail}    placeholder="you@email.com" />
            <Field label="PASSWORD" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {error && <p style={s.error}>{error}</p>}
            <button type="submit" style={s.btn} disabled={loading}>
              {loading
                ? (mode === 'signin' ? 'SIGNING IN...' : 'CREATING ACCOUNT...')
                : (mode === 'signin' ? 'SIGN IN →' : 'CREATE ACCOUNT →')
              }
            </button>
            <button
              type="button"
              style={s.toggle}
              onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError('') }}
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={s.label}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={s.input} placeholder={placeholder} required />
    </div>
  )
}

const s = {
  page:      { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card:      { width: '100%', maxWidth: '360px' },
  logo:      { fontWeight: 800, fontSize: '18px', letterSpacing: '0.15em', marginBottom: '8px' },
  sub:       { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', marginBottom: '36px', letterSpacing: '0.05em' },
  form:      { display: 'flex', flexDirection: 'column', gap: '18px' },
  label:     { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text2)' },
  input:     { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', color: 'var(--text)', fontSize: '14px' },
  error:     { color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '11px' },
  btn:       { background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '12px', letterSpacing: '0.1em', padding: '13px', borderRadius: 'var(--radius-sm)' },
  toggle:    { background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.05em', textAlign: 'center', padding: '4px' },
  doneBox:   { display: 'flex', flexDirection: 'column' },
  doneTitle: { fontSize: '18px', fontWeight: 800, marginBottom: '12px' },
  doneSub:   { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.7 },
}