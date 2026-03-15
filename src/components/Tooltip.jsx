import { useState, useRef, useEffect } from 'react'

export default function Tooltip({ text }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)
  const btnRef          = useRef(null)
  const [boxStyle, setBoxStyle] = useState({})

  // Reposition box so it never clips off left/right edge of screen
  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect      = btnRef.current.getBoundingClientRect()
    const boxWidth  = 240
    const padding   = 12
    const viewWidth = window.innerWidth

    // Default: align right edge of box to button
    let right = 0
    let left  = 'auto'

    // If box would clip left edge — flip to align left edge to button
    const boxLeft = rect.right - boxWidth
    if (boxLeft < padding) {
      right = 'auto'
      left  = Math.max(0, -(rect.left - padding)) + 'px'
    }

    setBoxStyle({ right, left })
  }, [open])

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
        ref={btnRef}
        style={{ ...s.btn, color: open ? 'var(--amber)' : 'var(--text3)' }}
        onClick={() => setOpen(o => !o)}
      >
        ⓘ
      </button>
      {open && (
        <div style={{ ...s.box, ...boxStyle }}>
          <p style={s.text}>{text}</p>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  btn:  { background: 'none', fontSize: '13px', lineHeight: 1, padding: '2px 4px', transition: 'color 0.15s', cursor: 'pointer' },
  box:  { position: 'absolute', top: '26px', zIndex: 300, width: '240px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
  text: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', lineHeight: 1.6, letterSpacing: '0.02em' },
}