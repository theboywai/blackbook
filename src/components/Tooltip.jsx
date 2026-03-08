import { useState, useRef, useEffect } from 'react'

/**
 * Info tooltip — click ⓘ to toggle, click outside to close.
 * Usage: <Tooltip text="This card shows..." />
 */
export default function Tooltip({ text }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={s.wrap}>
      <button
        style={{ ...s.btn, color: open ? 'var(--amber)' : 'var(--text3)' }}
        onClick={() => setOpen(o => !o)}
        title="What is this?"
      >
        ⓘ
      </button>
      {open && (
        <div style={s.box}>
          <div style={s.arrow} />
          <p style={s.text}>{text}</p>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap:  { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  btn:   { background: 'none', fontSize: '13px', lineHeight: 1, padding: '2px 4px', transition: 'color 0.15s', cursor: 'pointer' },
  box:   { position: 'absolute', top: '24px', right: 0, zIndex: 200, width: '240px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
  arrow: { position: 'absolute', top: '-5px', right: '10px', width: '8px', height: '8px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderBottom: 'none', borderRight: 'none', transform: 'rotate(45deg)' },
  text:  { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6, letterSpacing: '0.02em' },
}