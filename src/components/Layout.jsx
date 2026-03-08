import { Outlet, NavLink } from 'react-router-dom'
import { useLastUpload } from '@/hooks/useLastUpload'

export default function Layout({ onSignOut, reviewCount }) {
  const { label, urgency } = useLastUpload()

  const urgencyColor = { ok: 'var(--text3)', warning: 'var(--amber)', overdue: 'var(--red)' }

  const links = [
    ['/', 'DASHBOARD'],
    ['/transactions', 'TXN'],
    ['/budget', 'BUDGET'],
    ['/review', 'REVIEW'],
    ['/settings', 'SETTINGS'],
  ]

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <span style={s.logo}><span style={{ color: 'var(--amber)' }}>▪</span> BB</span>

        <div style={s.links}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              ...s.link, color: isActive ? 'var(--amber)' : 'var(--text2)',
            })}>
              {label}
              {label === 'REVIEW' && reviewCount > 0 && (
                <span style={s.badge}>{reviewCount}</span>
              )}
            </NavLink>
          ))}
        </div>

        <div style={s.right}>
          {label && (
            <div style={{ ...s.syncDot, color: urgencyColor[urgency] }}>
              ● {label.toUpperCase()}
              {urgency === 'warning' && ' · UPLOAD SOON'}
              {urgency === 'overdue' && ' · UPLOAD NOW'}
            </div>
          )}
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
  root:    { minHeight: '100dvh', display: 'flex', flexDirection: 'column' },
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '50px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100, gap: '16px' },
  logo:    { fontWeight: 800, fontSize: '14px', letterSpacing: '0.1em', flexShrink: 0, color: 'var(--text)' },
  links:   { display: 'flex', gap: '18px', flex: 1, justifyContent: 'center' },
  link:    { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: '5px' },
  badge:   { background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '9px', padding: '1px 5px', borderRadius: '10px' },
  right:   { display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 },
  syncDot: { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', transition: 'color 0.3s' },
  signOut: { background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em' },
  main:    { flex: 1, padding: '24px 20px', maxWidth: '860px', width: '100%', margin: '0 auto' },
}