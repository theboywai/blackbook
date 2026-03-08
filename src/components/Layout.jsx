import { Outlet, NavLink } from 'react-router-dom'

export default function Layout({ onSignOut, reviewCount }) {
  const links = [
    ['/', 'DASHBOARD'],
    ['/transactions', 'TRANSACTIONS'],
    ['/review', 'REVIEW'],
    ['/settings', 'SETTINGS'],
  ]

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <span style={s.logo}><span style={{ color: 'var(--amber)' }}>▪</span> BLACKBOOK</span>
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
        <button onClick={onSignOut} style={s.signOut}>OUT</button>
      </nav>
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  )
}

const s = {
  root:    { minHeight: '100dvh', display: 'flex', flexDirection: 'column' },
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '50px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100 },
  logo:    { fontWeight: 800, fontSize: '13px', letterSpacing: '0.15em', flexShrink: 0 },
  links:   { display: 'flex', gap: '20px' },
  link:    { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: '6px' },
  badge:   { background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '9px', padding: '1px 5px', borderRadius: '10px' },
  signOut: { background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', flexShrink: 0 },
  main:    { flex: 1, padding: '24px 20px', maxWidth: '860px', width: '100%', margin: '0 auto' },
}