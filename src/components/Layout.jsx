import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useLastUpload } from '@/hooks/useLastUpload'

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('bb-theme') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('bb-theme', theme)
  }, [theme])
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}

export default function Layout({ onSignOut, reviewCount }) {
  const { label, urgency } = useLastUpload()
  const { theme, toggle }  = useTheme()
  const urgencyColor = { ok: 'var(--text3)', warning: 'var(--amber)', overdue: 'var(--red)' }

  const links = [
    ['/', 'DASHBOARD'],
    ['/transactions', 'TXN'],
    ['/budget', 'BUDGET'],
    ['/upload', 'UPLOAD'],
    ['/review', 'REVIEW'],
    ['/settings', 'SETTINGS'],
  ]

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <span style={s.logo}><span style={{ color: 'var(--amber)' }}>▪</span> BB</span>

        <div style={s.linkStrip}>
          <div style={s.links}>
            {links.map(([to, lbl]) => (
              <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
                ...s.link, color: isActive ? 'var(--amber)' : 'var(--text2)',
              })}>
                {lbl}
                {lbl === 'REVIEW' && reviewCount > 0 && (
                  <span style={s.badge}>{reviewCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div style={s.right}>
          {label && (
            <div style={{ ...s.syncDot, color: urgencyColor[urgency] }}>
              ● {urgency === 'ok' ? label.toUpperCase() : urgency === 'warning' ? 'UPLOAD SOON' : 'UPLOAD NOW'}
            </div>
          )}
          <button onClick={toggle} style={s.themeBtn} title="Toggle theme">
            {theme === 'dark' ? '☀︎' : '☽'}
          </button>
          <button onClick={onSignOut} style={s.signOut}>OUT</button>
        </div>
      </nav>
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  )
}

const s = {
  root:      { minHeight: '100dvh', display: 'flex', flexDirection: 'column' },
  nav:       { display: 'flex', alignItems: 'center', padding: '0 16px', height: '50px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100, gap: '12px' },
  logo:      { fontWeight: 800, fontSize: '14px', letterSpacing: '0.1em', flexShrink: 0, color: 'var(--text)' },
  linkStrip: { flex: 1, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' },
  links:     { display: 'flex', gap: '20px', width: 'max-content', padding: '0 4px' },
  link:      { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' },
  badge:     { background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '9px', padding: '1px 5px', borderRadius: '10px' },
  right:     { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  syncDot:   { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', whiteSpace: 'nowrap' },
  themeBtn:  { background: 'none', color: 'var(--text2)', fontSize: '16px', lineHeight: 1, padding: '2px', transition: 'color 0.15s' },
  signOut:   { background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em' },
  main:      { flex: 1, padding: '20px 16px', maxWidth: '860px', width: '100%', margin: '0 auto' },
}