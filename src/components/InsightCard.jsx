export default function InsightCard({ insight }) {
  const colors = {
    good:    { bg: 'var(--green-bg)', border: '#1a3d2b', dot: 'var(--green)' },
    bad:     { bg: 'var(--red-bg)',   border: '#3d1a1a', dot: 'var(--red)'   },
    neutral: { bg: 'var(--bg3)',      border: 'var(--border)', dot: 'var(--text3)' },
  }
  const c = colors[insight.sentiment] || colors.neutral

  return (
    <div style={{ ...s.card, background: c.bg, borderColor: c.border }}>
      <div style={{ ...s.dot, background: c.dot }} />
      <div>
        <div style={s.title}>{insight.title}</div>
        <div style={s.sub}>{insight.subtitle}</div>
      </div>
    </div>
  )
}

const s = {
  card:  { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid' },
  dot:   { width: '6px', height: '6px', borderRadius: '50%', marginTop: '5px', flexShrink: 0 },
  title: { fontSize: '13px', fontWeight: 600, marginBottom: '3px' },
  sub:   { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.03em' },
}