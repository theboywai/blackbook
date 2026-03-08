export default function KPICard({ label, value, color, sub }) {
  return (
    <div style={s.card}>
      <div style={s.label}>{label}</div>
      <div style={{ ...s.value, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={s.sub}>{sub}</div>}
    </div>
  )
}

const s = {
  card:  { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' },
  label: { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text2)', marginBottom: '8px' },
  value: { fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em' },
  sub:   { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '6px' },
}