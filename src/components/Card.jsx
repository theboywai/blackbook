import Tooltip from './Tooltip'

export default function Card({ title, info, action, children, style }) {
  return (
    <div style={{ ...s.card, ...style }}>
      {(title || action || info) && (
        <div style={s.header}>
          <div style={s.left}>
            {title && <div style={s.title}>{title}</div>}
            {info  && <Tooltip text={info} />}
          </div>
          {action && action}
        </div>
      )}
      {children}
    </div>
  )
}

const s = {
  card:   { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  left:   { display: 'flex', alignItems: 'center', gap: '6px' },
  title:  { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text2)' },
}