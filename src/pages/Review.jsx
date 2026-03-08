import { useState } from 'react'
import { useReview } from '@/hooks/useReview'
import { createMerchant } from '@/data/merchants'
import Card from '@/components/Card'
import Loader from '@/components/Loader'

export default function Review() {
  const { txns, categories, loading, saving, saveCategory } = useReview()

  if (loading) return <Loader />

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>Review Queue</div>
        <div style={s.badge}>{txns.length} PENDING</div>
      </div>

      {txns.length === 0 ? (
        <div style={s.empty}>
          <div style={s.tick}>✓</div>
          <div style={s.emptyText}>ALL CAUGHT UP</div>
        </div>
      ) : (
        <div style={s.list}>
          {txns.map(tx => (
            <ReviewCard
              key={tx.id}
              tx={tx}
              categories={categories}
              onSave={saveCategory}
              saving={saving[tx.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ tx, categories, onSave, saving }) {
  const label      = tx.upi_note || tx.upi_merchant_raw || tx.raw_description?.slice(0, 50) || '—'
  const isCredit   = tx.direction === 'credit'

  // Category selection state
  const [selectedCatId, setSelectedCatId] = useState('')

  // Merchant promotion state
  const [saveMerchant, setSaveMerchant]   = useState(false)
  const [merchantName, setMerchantName]   = useState(label)
  const [merchantError, setMerchantError] = useState('')
  const [submitting, setSubmitting]       = useState(false)

  async function handleSubmit() {
    if (!selectedCatId) return
    setSubmitting(true)
    setMerchantError('')

    try {
      // If user wants to save as merchant, create it first
      if (saveMerchant && merchantName.trim()) {
        await createMerchant({
          display_name:  merchantName.trim(),
          upi_handle:    tx.upi_handle || null,
          category_id:   Number(selectedCatId),
          merchant_type: isCredit ? 'person' : 'business',
        })
      }
      // Always save the category on the transaction
      await onSave(tx.id, selectedCatId)
    } catch (e) {
      setMerchantError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <Card>
      {/* Transaction header */}
      <div style={s.top}>
        <div style={s.left}>
          <div style={s.txLabel}>{label}</div>
          <div style={s.txMeta}>
            {tx.txn_date}
            {tx.upi_handle && <span style={s.upi}> · {tx.upi_handle}</span>}
          </div>
        </div>
        <div style={{ ...s.amount, color: isCredit ? 'var(--green)' : 'var(--text)' }}>
          {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
        </div>
      </div>

      {/* Category picker */}
      <div style={s.row}>
        <select
          style={s.select}
          value={selectedCatId}
          onChange={e => setSelectedCatId(e.target.value)}
          disabled={submitting || saving}
        >
          <option value="" disabled>Select category...</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Merchant toggle — only show for debits with a UPI handle */}
      {tx.upi_merchant_raw && selectedCatId && (
        <div style={s.merchantSection}>
          <label style={s.checkRow}>
            <input
              type="checkbox"
              checked={saveMerchant}
              onChange={e => setSaveMerchant(e.target.checked)}
              style={s.checkbox}
            />
            <span style={s.checkLabel}>Save as merchant for future auto-matching</span>
          </label>

          {saveMerchant && (
            <input
              style={s.nameInput}
              value={merchantName}
              onChange={e => setMerchantName(e.target.value)}
              placeholder="Display name..."
            />
          )}
        </div>
      )}

      {merchantError && <div style={s.error}>{merchantError}</div>}

      {/* Submit */}
      {selectedCatId && (
        <button
          style={{ ...s.btn, opacity: submitting || saving ? 0.5 : 1 }}
          onClick={handleSubmit}
          disabled={submitting || saving}
        >
          {submitting || saving ? 'SAVING...' : saveMerchant ? 'SAVE + ADD MERCHANT →' : 'SAVE →'}
        </button>
      )}
    </Card>
  )
}

const s = {
  page:            { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:          { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:           { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  badge:           { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-bg)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--amber-dim)' },
  list:            { display: 'flex', flexDirection: 'column', gap: '10px' },
  top:             { display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '14px' },
  left:            { flex: 1, minWidth: 0 },
  txLabel:         { fontSize: '14px', fontWeight: 700, marginBottom: '4px' },
  txMeta:          { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)' },
  upi:             { color: 'var(--text3)' },
  amount:          { fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 500, flexShrink: 0 },
  row:             { marginBottom: '12px' },
  select:          { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px' },
  merchantSection: { background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  checkRow:        { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  checkbox:        { accentColor: 'var(--amber)', width: '14px', height: '14px', cursor: 'pointer' },
  checkLabel:      { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.05em' },
  nameInput:       { width: '100%', background: 'var(--bg2)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: 'var(--text)', fontSize: '13px' },
  btn:             { width: '100%', background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '11px', letterSpacing: '0.1em', padding: '11px', borderRadius: 'var(--radius-sm)', transition: 'opacity 0.15s' },
  error:           { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', marginBottom: '10px' },
  empty:           { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '80px 0' },
  tick:            { fontSize: '28px', color: 'var(--green)' },
  emptyText:       { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', letterSpacing: '0.12em' },
}