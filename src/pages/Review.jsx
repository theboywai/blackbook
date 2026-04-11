import { useState } from 'react'
import { useReview } from '@/hooks/useReview'
import { createMerchant } from '@/data/merchants'
import { createSplit, linkRecovery } from '@/data/splits'
import Card from '@/components/Card'
import Loader from '@/components/Loader'

export default function Review() {
  const { txns, splitTxns, openSplits, categories, loading, saving, saveCategory, removeSplitTxn, refreshSplits } = useReview()

  if (loading) return <Loader />

  const totalPending = txns.length + splitTxns.length

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>Review Queue</div>
        <div style={s.badge}>{totalPending} PENDING</div>
      </div>

      {totalPending === 0 ? (
        <div style={s.empty}>
          <div style={s.tick}>✓</div>
          <div style={s.emptyText}>ALL CAUGHT UP</div>
        </div>
      ) : (
        <div style={s.list}>

          {/* Split-flagged transactions */}
          {splitTxns.length > 0 && (
            <>
              <div style={s.sectionLabel}>SPLITS TO RESOLVE</div>
              {splitTxns.map(tx => (
                <SplitCard
                  key={tx.id}
                  tx={tx}
                  openSplits={openSplits}
                  onDone={() => { removeSplitTxn(tx.id); refreshSplits() }}
                />
              ))}
            </>
          )}

          {/* Uncategorized transactions */}
          {txns.length > 0 && (
            <>
              {splitTxns.length > 0 && <div style={s.sectionLabel}>UNCATEGORIZED</div>}
              {txns.map(tx => (
                <ReviewCard
                  key={tx.id}
                  tx={tx}
                  categories={categories}
                  onSave={saveCategory}
                  saving={saving[tx.id]}
                />
              ))}
            </>
          )}

        </div>
      )}
    </div>
  )
}

// ── Split Card ─────────────────────────────────────────────────────────────────
function SplitCard({ tx, openSplits, onDone }) {
  const isCredit  = tx.direction === 'credit'
  const label     = tx.upi_note || tx.upi_merchant_raw || tx.raw_description?.slice(0, 50) || '—'

  // Mode: 'choose' | 'create' | 'link'
  const [mode, setMode]           = useState(isCredit ? 'link' : 'choose')
  const [myShare, setMyShare]     = useState('')
  const [desc, setDesc]           = useState(label)
  const [selectedSplit, setSelectedSplit] = useState(openSplits[0]?.id || '')
  const [personName, setPersonName]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  async function handleCreateSplit() {
    const total   = Number(tx.amount)
    const share   = Number(myShare)
    if (!share || share <= 0 || share > total) {
      setError('My share must be between 0 and total amount')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createSplit(tx.id, { description: desc, totalAmount: total, myShare: share })
      onDone()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  async function handleLinkRecovery() {
    if (!selectedSplit) { setError('Select a split to link'); return }
    setSaving(true)
    setError(null)
    try {
      await linkRecovery(tx.id, selectedSplit, Number(tx.amount), personName || null)
      onDone()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Card>
      {/* Header */}
      <div style={s.top}>
        <div style={s.left}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={s.splitBadge}>SPLIT</span>
            <div style={s.txLabel}>{label}</div>
          </div>
          <div style={s.txMeta}>
            {tx.txn_date}
            {tx.upi_handle && <span style={s.upi}> · {tx.upi_handle}</span>}
          </div>
        </div>
        <div style={{ ...s.amount, color: isCredit ? 'var(--green)' : 'var(--text)' }}>
          {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
        </div>
      </div>

      {/* Debit — choose create or link */}
      {!isCredit && mode === 'choose' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button style={s.modeBtn} onClick={() => setMode('create')}>
            I PAID FOR OTHERS →
          </button>
          <button style={{ ...s.modeBtn, background: 'var(--bg3)' }} onClick={() => setMode('link')}>
            LINK TO EXISTING SPLIT
          </button>
        </div>
      )}

      {/* Create split — for debit */}
      {mode === 'create' && (
        <div style={s.splitForm}>
          <div style={s.formField}>
            <div style={s.formLabel}>DESCRIPTION</div>
            <input
              style={s.input}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="e.g. March rent"
            />
          </div>
          <div style={s.formField}>
            <div style={s.formLabel}>MY SHARE (₹)</div>
            <input
              style={s.input}
              type="number"
              value={myShare}
              onChange={e => setMyShare(e.target.value)}
              placeholder={`out of ₹${Number(tx.amount).toLocaleString('en-IN')}`}
            />
          </div>
          {myShare && Number(myShare) > 0 && Number(myShare) < Number(tx.amount) && (
            <div style={s.splitPreview}>
              <span style={{ color: 'var(--text3)' }}>OTHERS OWE YOU</span>
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                ₹{(Number(tx.amount) - Number(myShare)).toLocaleString('en-IN')}
              </span>
            </div>
          )}
          {error && <div style={s.error}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.modeBtn, background: 'var(--bg3)' }} onClick={() => setMode('choose')}>← BACK</button>
            <button
              style={{ ...s.btn, flex: 1, opacity: saving ? 0.5 : 1 }}
              onClick={handleCreateSplit}
              disabled={saving}
            >
              {saving ? 'SAVING...' : 'CREATE SPLIT →'}
            </button>
          </div>
        </div>
      )}

      {/* Link recovery — for credit or debit linking to existing */}
      {mode === 'link' && (
        <div style={s.splitForm}>
          {isCredit && (
            <div style={s.formField}>
              <div style={s.formLabel}>PERSON NAME (OPTIONAL)</div>
              <input
                style={s.input}
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                placeholder="e.g. Rohan"
              />
            </div>
          )}
          <div style={s.formField}>
            <div style={s.formLabel}>LINK TO SPLIT</div>
            {openSplits.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', padding: '8px 0' }}>
                No open splits — create one first from the debit transaction
              </div>
            ) : (
              <select
                style={s.select}
                value={selectedSplit}
                onChange={e => setSelectedSplit(e.target.value)}
              >
                {openSplits.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.description} · ₹{Number(sp.expected_recovery - sp.recovered_amount).toLocaleString('en-IN')} pending
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <div style={s.error}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isCredit && <button style={{ ...s.modeBtn, background: 'var(--bg3)' }} onClick={() => setMode('choose')}>← BACK</button>}
            <button
              style={{ ...s.btn, flex: 1, opacity: (saving || openSplits.length === 0) ? 0.5 : 1 }}
              onClick={handleLinkRecovery}
              disabled={saving || openSplits.length === 0}
            >
              {saving ? 'SAVING...' : 'LINK RECOVERY →'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Review Card (unchanged) ────────────────────────────────────────────────────
function ReviewCard({ tx, categories, onSave, saving }) {
  const label    = tx.upi_note || tx.upi_merchant_raw || tx.raw_description?.slice(0, 50) || '—'
  const isCredit = tx.direction === 'credit'

  const [selectedCatId, setSelectedCatId] = useState('')
  const [saveMerchant, setSaveMerchant]   = useState(false)
  const [merchantName, setMerchantName]   = useState(label)
  const [merchantError, setMerchantError] = useState('')
  const [submitting, setSubmitting]       = useState(false)

  async function handleSubmit() {
    if (!selectedCatId) return
    setSubmitting(true)
    setMerchantError('')
    try {
      if (saveMerchant && merchantName.trim()) {
        await createMerchant({
          display_name:  merchantName.trim(),
          upi_handle:    tx.upi_handle || null,
          category_id:   Number(selectedCatId),
          merchant_type: isCredit ? 'person' : 'business',
        })
      }
      await onSave(tx.id, selectedCatId)
    } catch (e) {
      setMerchantError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <Card>
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

      {tx.upi_merchant_raw && selectedCatId && (
        <div style={s.merchantSection}>
          <label style={s.checkRow}>
            <input type="checkbox" checked={saveMerchant} onChange={e => setSaveMerchant(e.target.checked)} style={s.checkbox} />
            <span style={s.checkLabel}>Save as merchant for future auto-matching</span>
          </label>
          {saveMerchant && (
            <input style={s.nameInput} value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder="Display name..." />
          )}
        </div>
      )}

      {merchantError && <div style={s.error}>{merchantError}</div>}

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
  sectionLabel:    { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text3)', paddingLeft: '2px' },
  list:            { display: 'flex', flexDirection: 'column', gap: '10px' },
  top:             { display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '14px' },
  left:            { flex: 1, minWidth: 0 },
  txLabel:         { fontSize: '14px', fontWeight: 700, marginBottom: '4px' },
  txMeta:          { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)' },
  upi:             { color: 'var(--text3)' },
  amount:          { fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 500, flexShrink: 0 },
  splitBadge:      { fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', borderRadius: '3px', padding: '2px 6px', flexShrink: 0 },
  splitForm:       { display: 'flex', flexDirection: 'column', gap: '12px' },
  formField:       { display: 'flex', flexDirection: 'column', gap: '6px' },
  formLabel:       { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)' },
  splitPreview:    { display: 'flex', justifyContent: 'space-between', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px' },
  input:           { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%' },
  row:             { marginBottom: '12px' },
  select:          { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px' },
  merchantSection: { background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  checkRow:        { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  checkbox:        { accentColor: 'var(--amber)', width: '14px', height: '14px', cursor: 'pointer' },
  checkLabel:      { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.05em' },
  nameInput:       { width: '100%', background: 'var(--bg2)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: 'var(--text)', fontSize: '13px' },
  modeBtn:         { flex: 1, background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', padding: '10px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  btn:             { width: '100%', background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '11px', letterSpacing: '0.1em', padding: '11px', borderRadius: 'var(--radius-sm)', transition: 'opacity 0.15s' },
  error:           { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' },
  empty:           { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '80px 0' },
  tick:            { fontSize: '28px', color: 'var(--green)' },
  emptyText:       { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', letterSpacing: '0.12em' },
}