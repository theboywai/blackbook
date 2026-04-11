import { useState, useEffect, useRef } from 'react'
import { updateTransactionCategory, updateTransactionLabel, updateTransactionOneTime, deleteTransaction } from '@/data/transactions'
import { markAsSplit } from '@/data/splits'
import { fetchCategories } from '@/data/categories'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function TxnRow({ tx, last, onUpdated }) {
  const [expanded, setExpanded] = useState(false)
  const [cats, setCats]         = useState([])
  const [catId, setCatId]       = useState(tx.category_id || '')
  const [label, setLabel]       = useState(tx.upi_merchant_raw || tx.upi_note || '')
  const [oneTime, setOneTime]   = useState(tx.is_one_time || false)
  const [isSplit, setIsSplit]   = useState(tx.is_split || false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const displayLabel = tx.upi_merchant_raw || tx.upi_note || tx.raw_description?.slice(0, 40) || '—'
  const isCredit     = tx.direction === 'credit'
  const catName      = tx.categories?.name || (tx.is_internal_transfer ? 'Self Transfer' : null)

  useEffect(() => {
    if (expanded && cats.length === 0) fetchCategories().then(setCats)
  }, [expanded])

  useEffect(() => {
    setCatId(tx.category_id || '')
    setLabel(tx.upi_merchant_raw || tx.upi_note || '')
    setOneTime(tx.is_one_time || false)
    setIsSplit(tx.is_split || false)
  }, [tx.category_id, tx.upi_merchant_raw, tx.is_one_time, tx.is_split])

  async function handleSave() {
    setSaving(true)
    try {
      const promises = []
      if (String(catId) !== String(tx.category_id || ''))
        promises.push(updateTransactionCategory(tx.id, catId || null))
      if (label !== (tx.upi_merchant_raw || tx.upi_note || ''))
        promises.push(updateTransactionLabel(tx.id, label))
      if (oneTime !== (tx.is_one_time || false))
        promises.push(updateTransactionOneTime(tx.id, oneTime))
      if (isSplit !== (tx.is_split || false))
        promises.push(markAsSplit(tx.id, isSplit))

      if (promises.length > 0) {
        await Promise.all(promises)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        onUpdated?.()
      }
      setExpanded(false)
    } catch (e) {
      console.error('Save failed', e)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setCatId(tx.category_id || '')
    setLabel(tx.upi_merchant_raw || tx.upi_note || '')
    setOneTime(tx.is_one_time || false)
    setIsSplit(tx.is_split || false)
    setExpanded(false)
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return }
    setDeleting(true)
    try {
      await deleteTransaction(tx.id)
      onUpdated?.()
    } catch (e) {
      console.error('Delete failed', e)
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  const isDirty =
    String(catId) !== String(tx.category_id || '') ||
    label         !== (tx.upi_merchant_raw || tx.upi_note || '') ||
    oneTime       !== (tx.is_one_time || false) ||
    isSplit       !== (tx.is_split || false)

  return (
    <div style={{ borderBottom: last && !expanded ? 'none' : '1px solid var(--border)' }}>

      {/* Main row */}
      <div
        style={{ ...s.row, background: expanded ? 'var(--bg3)' : 'transparent', cursor: 'pointer' }}
        onClick={() => setExpanded(o => !o)}
      >
        <div style={s.left}>
          <div style={s.labelRow}>
            <span style={s.label}>{displayLabel}</span>
            {tx.is_one_time && <span style={s.oneTimeBadge}>1×</span>}
            {tx.is_split && <span style={s.splitBadge}>SPLIT</span>}
          </div>
          <div style={s.meta}>
            {tx.txn_date} · {catName
              ? <span style={saved ? { color: 'var(--green)' } : {}}>{catName}{saved ? ' ✓' : ''}</span>
              : <span style={{ color: 'var(--amber)' }}>Uncategorized</span>
            }
          </div>
        </div>
        <div style={{ ...s.amount, color: isCredit ? 'var(--green)' : tx.is_one_time ? 'var(--text2)' : 'var(--text)' }}>
          {isCredit ? '+' : '-'}{fmt(tx.amount)}
        </div>
        <div style={{ ...s.chevron, transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</div>
      </div>

      {/* Edit panel */}
      {expanded && (
        <div style={s.panel} onClick={e => e.stopPropagation()}>
          <div style={s.panelRow}>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>NAME</label>
              <input
                style={s.input}
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Display name"
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>CATEGORY</label>
              <select style={s.select} value={catId} onChange={e => setCatId(e.target.value)}>
                <option value="">Uncategorized</option>
                {(() => {
                  const parents = cats.filter(c => !c.parent_id)
                  const children = cats.filter(c => c.parent_id)
                  return parents.map(p => (
                    <optgroup key={p.id} label={p.name}>
                      <option value={p.id}>{p.name} (general)</option>
                      {children.filter(ch => ch.parent_id === p.id).map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </optgroup>
                  ))
                })()}
              </select>
            </div>
          </div>

          {/* One-time toggle */}
          <div style={s.toggleRow} onClick={() => setOneTime(o => !o)}>
            <div style={{ ...s.toggle, background: oneTime ? 'var(--amber)' : 'var(--border2)' }}>
              <div style={{ ...s.toggleThumb, transform: oneTime ? 'translateX(14px)' : 'translateX(0)' }} />
            </div>
            <div>
              <div style={s.toggleLabel}>One-time purchase</div>
              <div style={s.toggleSub}>Excluded from regular monthly spend analytics</div>
            </div>
          </div>

          {/* Split toggle */}
          <div style={s.toggleRow} onClick={() => setIsSplit(o => !o)}>
            <div style={{ ...s.toggle, background: isSplit ? 'var(--amber)' : 'var(--border2)' }}>
              <div style={{ ...s.toggleThumb, transform: isSplit ? 'translateX(14px)' : 'translateX(0)' }} />
            </div>
            <div>
              <div style={s.toggleLabel}>Split transaction</div>
              <div style={s.toggleSub}>Send to Review to define shares and link recoveries</div>
            </div>
          </div>

          <div style={s.rawDesc}>{tx.raw_description}</div>

          <div style={s.actions}>
            <button
              style={{ ...s.deleteBtn, background: confirmDel ? 'var(--red)' : 'none', color: confirmDel ? '#fff' : 'var(--red)', opacity: deleting ? 0.4 : 1 }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : confirmDel ? 'Confirm delete' : 'Delete'}
            </button>
            <div style={{ flex: 1 }} />
            <button style={s.cancelBtn} onClick={() => { handleCancel(); setConfirmDel(false) }}>Cancel</button>
            <button
              style={{ ...s.saveBtn, opacity: (!isDirty || saving) ? 0.4 : 1 }}
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  row:          { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', transition: 'background 0.15s' },
  left:         { flex: 1, minWidth: 0 },
  labelRow:     { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' },
  label:        { fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  oneTimeBadge: { flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.05em' },
  splitBadge:   { flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.05em' },
  meta:         { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.03em' },
  amount:       { fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' },
  chevron:      { fontSize: '11px', color: 'var(--text3)', transition: 'transform 0.2s', flexShrink: 0 },

  panel:        { background: 'var(--bg2)', borderTop: '1px solid var(--border)', padding: '14px 0', display: 'flex', flexDirection: 'column', gap: '12px' },
  panelRow:     { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  fieldGroup:   { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '140px' },
  fieldLabel:   { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)' },
  input:        { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text)', fontSize: '12px', width: '100%' },
  select:       { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font-mono)', width: '100%' },

  toggleRow:    { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  toggle:       { flexShrink: 0, width: '30px', height: '16px', borderRadius: '8px', position: 'relative', transition: 'background 0.2s' },
  toggleThumb:  { position: 'absolute', top: '2px', left: '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s' },
  toggleLabel:  { fontSize: '12px', fontWeight: 600 },
  toggleSub:    { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '2px' },

  rawDesc:      { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', lineHeight: 1.5, wordBreak: 'break-all' },
  actions:      { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  deleteBtn:    { fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', padding: '6px 14px', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s' },
  cancelBtn:    { background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', padding: '6px 14px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)' },
  saveBtn:      { background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', padding: '6px 18px', borderRadius: 'var(--radius-sm)', transition: 'opacity 0.15s' },
}