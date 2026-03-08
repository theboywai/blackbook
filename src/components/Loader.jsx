export default function Loader({ text = 'LOADING...' }) {
  return (
    <div style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', padding: '48px 0' }}>
      {text}
    </div>
  )
}