import { useState } from 'react'
import { useReview } from '@/hooks/useReview'
import { createMerchant } from '@/data/merchants'
import {
  createSplit, linkRecovery, linkRecoveryToMultipleSplits,
  unlinkRecovery, resolveManually, fetchOpenSplits
} from '@/data/splits'
import Card from '@/components/Card'
import Loader from '@/components/Loader'

export default function Review() {
  const {
    txns, splitTxns, splitCredits, categories,
    loading, saving, saveCategory, removeSplitTxn, refreshSplits
  } = useReview()

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

          {splitTxns.length > 0 && (
            <>
              <div style={s.sectionLabel}>SPLITS TO RESOLVE</div>
              {splitTxns.map(tx => (
                <SplitCard
                  key={tx.id}
                  tx={tx}
                  splitCredits={splitCredits}
                  onCreated={refreshSplits}
                  onChanged={refreshSplits}
                  onResolved={() => { removeSplitTxn(tx.id); refreshSplits() }}
                />
              ))}
            </>
          )}

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

// ── Resolve Confirmation Modal ─────────────────────────────────────────────────
function ResolveModal({ shortfall, onAbsorb, onIgnore, onCancel }) {
  return (
    <div style={s.modalOverlay}>
      <div style={s.modal}>
        <div style={s.modalTitle}>RECOVERY SHORTFALL</div>
        <div style={s.modalBody}>
          ₹{shortfall.toLocaleString('en-IN')} is still pending recovery.
          How do you want to handle it?
        </div>
        <div style={s.modalActions}>
          <button style={s.modalAbsorb} onClick={onAbsorb}>
            ADD TO MY SHARE
            <span style={s.modalSub}>shortfall becomes your expense</span>
          </button>
          <button style={s.modalIgnore} onClick={onIgnore}>
            CLOSE ANYWAY
            <span style={s.modalSub}>mark as settled, ignore shortfall</span>
          </button>
        </div>
        <button style={s.modalCancel} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  )
}

// ── Multi-Split Allocator Modal ────────────────────────────────────────────────
function MultiSplitModal({ credit, openSplits, onConfirm, onCancel }) {
  const creditAmount = Number(credit.amount)

  // Each row: splitId, description, expected_recovery, recovered_amount, typed amount
  const [rows, setRows] = useState(
    (openSplits || []).map(sp => ({
      splitId:           sp.id,
      description:       sp.description || '—',
      expectedRecovery:  Number(sp.expected_recovery || 0),
      recoveredAmount:   Number(sp.recovered_amount  || 0),
      amount:            '',
    }))
  )

  const totalAllocated = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const remaining      = creditAmount - totalAllocated
  const overAllocated  = totalAllocated > creditAmount
  const isValid        = totalAllocated > 0 && !overAllocated

  function setAmount(splitId, value) {
    setRows(prev => prev.map(r => r.splitId === splitId ? { ...r, amount: value } : r))
  }

  function handleConfirm() {
    const filled = rows
      .filter(r => Number(r.amount) > 0)
      .map(r => ({ splitId: r.splitId, amount: Number(r.amount) }))
    onConfirm(filled)
  }

  return (
    <div style={s.modalOverlay}>
      <div style={{ ...s.modal, maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={s.modalTitle}>SPLIT PAYMENT ACROSS SPLITS</div>
        <div style={s.modalBody}>
          Incoming +₹{creditAmount.toLocaleString('en-IN')} — type how much goes to each split. Leave blank to skip.
        </div>

        {rows.length === 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', padding: '8px 0' }}>
            No open splits found. Make sure splits exist before using this flow.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '12px 0' }}>
          {rows.map(r => {
            const stillOwed = Math.max(0, r.expectedRecovery - r.recoveredAmount)
            return (
              <div key={r.splitId} style={s.allocRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.allocDesc}>{r.description}</div>
                  {stillOwed > 0 && (
                    <div style={s.allocOwed}>₹{stillOwed.toLocaleString('en-IN')} still owed</div>
                  )}
                </div>
                <div style={s.allocInputWrap}>
                  <span style={s.allocRupee}>₹</span>
                  <input
                    style={s.allocInput}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={r.amount}
                    onChange={e => setAmount(r.splitId, e.target.value)}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div style={s.allocSummary}>
          <span style={{ color: 'var(--text3)' }}>ALLOCATED</span>
          <span style={{ color: overAllocated ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
            ₹{totalAllocated.toLocaleString('en-IN')} / ₹{creditAmount.toLocaleString('en-IN')}
          </span>
        </div>

        {remaining > 0 && totalAllocated > 0 && (
          <div style={s.allocRemaining}>
            ₹{remaining.toLocaleString('en-IN')} unallocated — stays as pending credit
          </div>
        )}
        {overAllocated && (
          <div style={{ ...s.allocRemaining, color: 'var(--red)' }}>
            Over by ₹{(totalAllocated - creditAmount).toLocaleString('en-IN')} — reduce some amounts
          </div>
        )}

        <div style={{ ...s.modalActions, marginTop: '8px' }}>
          <button
            style={{ ...s.modalAbsorb, opacity: isValid ? 1 : 0.4 }}
            onClick={handleConfirm}
            disabled={!isValid}
          >
            CONFIRM ALLOCATION →
          </button>
        </div>
        <button style={s.modalCancel} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  )
}

// ── Split Card ─────────────────────────────────────────────────────────────────
function SplitCard({ tx, splitCredits, onCreated, onChanged, onResolved }) {
  const label = tx.upi_note || tx.upi_merchant_raw || tx.raw_description?.slice(0, 50) || '—'
  const total = Number(tx.amount)

  const initialMode = tx.split_type === 'paid' ? 'recover' : 'setup'

  const [mode, setMode]           = useState(initialMode)
  const [myShare, setMyShare]     = useState('')
  const [desc, setDesc]           = useState(label)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [resolveModal, setResolveModal] = useState(false) // shows confirm dialog
  const [multiModal, setMultiModal]     = useState(null)  // credit tx being multi-allocated

  const splitId      = tx.split_id
  const unlinkedCredits = splitCredits.filter(c => !c.split_id)
  const linkedCredits   = splitCredits.filter(c => c.split_id === splitId)
  const recoveredTotal  = linkedCredits.reduce((sum, c) => sum + Number(c.amount), 0)
  const expectedRecovery = total - (myShare !== '' ? Number(myShare) : 0)

  // ── Create split ────────────────────────────────────────────────────────────
  async function handleCreateSplit() {
    if (myShare === '') { setError('Enter your share (0 if you expect full recovery)'); return }
    const share = Number(myShare)
    if (share < 0 || share > total) {
      setError(`My share must be between ₹0 and ₹${total.toLocaleString('en-IN')}`)
      return
    }
    setSaving(true); setError(null)
    try {
      await createSplit(tx.id, { description: desc, totalAmount: total, myShare: share })
      setMode('recover')
      await onCreated()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Resolve: check if shortfall exists first ─────────────────────────────
  async function handleResolveClick() {
    if (!splitId) { setError('Create the split first'); return }
    setSaving(true); setError(null)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: split, error: fetchErr } = await supabase
        .from('splits')
        .select('expected_recovery, recovered_amount')
        .eq('id', splitId)
        .single()
      if (fetchErr) throw fetchErr
      const shortfall = Math.max(0, Number(split.expected_recovery) - Number(split.recovered_amount))
      if (shortfall > 0) {
        setResolveModal({ shortfall })
      } else {
        await doResolve(true)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function doResolve(absorbShortfall) {
    setResolveModal(false)
    setSaving(true); setError(null)
    try {
      await resolveManually(splitId, tx.id, { absorbShortfall })
      await onResolved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  // ── Link single credit ──────────────────────────────────────────────────────
  async function handleLink(credit) {
    if (!splitId) { setError('Split not created yet'); return }
    setSaving(true); setError(null)
    try {
      await linkRecovery(credit.id, splitId, Number(credit.amount))
      await onChanged()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Open multi-split modal for a credit ────────────────────────────────────
  async function handleOpenMultiLink(credit) {
    // Fetch all open splits to offer as allocation targets
    try {
      const openSplits = await fetchOpenSplits()
      setMultiModal({ credit, openSplits })
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleMultiConfirm(allocations) {
    const credit = multiModal.credit
    setMultiModal(null)
    setSaving(true); setError(null)
    try {
      await linkRecoveryToMultipleSplits(credit.id, allocations)
      // onResolved removes this card from splitTxns and refreshes splits,
      // covering the case where this split itself got auto-resolved
      await onResolved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Unlink credit ───────────────────────────────────────────────────────────
  async function handleUnlink(credit) {
    if (!splitId) return
    setSaving(true); setError(null)
    try {
      await unlinkRecovery(credit.id, splitId, Number(credit.amount))
      await onChanged()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const othersOwe = myShare !== '' ? total - Number(myShare) : null

  return (
    <>
      {/* Resolve shortfall confirmation */}
      {resolveModal && (
        <ResolveModal
          shortfall={resolveModal.shortfall}
          onAbsorb={() => doResolve(true)}
          onIgnore={() => doResolve(false)}
          onCancel={() => setResolveModal(false)}
        />
      )}

      {/* Multi-split allocation modal */}
      {multiModal && (
        <MultiSplitModal
          credit={multiModal.credit}
          openSplits={multiModal.openSplits}
          onConfirm={handleMultiConfirm}
          onCancel={() => setMultiModal(null)}
        />
      )}

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
          <div style={{ ...s.amount, color: 'var(--text)' }}>
            -₹{total.toLocaleString('en-IN')}
          </div>
        </div>

        {/* ── SETUP MODE ── */}
        {mode === 'setup' && (
          <div style={s.form}>
            <div style={s.field}>
              <div style={s.label}>DESCRIPTION</div>
              <input
                style={s.input}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="e.g. March rent"
              />
            </div>
            <div style={s.field}>
              <div style={s.label}>MY SHARE (₹) — enter 0 if others owe you the full amount</div>
              <input
                style={s.input}
                type="number"
                min="0"
                value={myShare}
                onChange={e => setMyShare(e.target.value)}
                placeholder={`out of ₹${total.toLocaleString('en-IN')}`}
              />
            </div>

            {othersOwe !== null && (
              <div style={s.preview}>
                <span style={{ color: 'var(--text3)' }}>
                  {othersOwe === 0 ? 'FULL AMOUNT OWED BACK' : 'OTHERS OWE YOU'}
                </span>
                <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                  ₹{(othersOwe === 0 ? total : othersOwe).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {error && <div style={s.error}>{error}</div>}

            <button
              style={{ ...s.btn, opacity: saving ? 0.5 : 1 }}
              onClick={handleCreateSplit}
              disabled={saving}
            >
              {saving ? 'SAVING...' : 'CREATE SPLIT →'}
            </button>
          </div>
        )}

        {/* ── RECOVER MODE ── */}
        {mode === 'recover' && (
          <div style={s.form}>

            {/* Recovery progress */}
            <div style={s.progressBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={s.label}>RECOVERED</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--amber)' }}>
                  ₹{recoveredTotal.toLocaleString('en-IN')}
                </span>
              </div>
              {linkedCredits.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {linkedCredits.map(c => {
                    const name = c.upi_merchant_raw || c.upi_note || c.raw_description?.slice(0, 30) || '—'
                    return (
                      <div key={c.id} style={s.linkedRow}>
                        <div style={s.linkedLeft}>
                          <div style={s.linkedName}>{name}</div>
                          <div style={s.linkedMeta}>{c.txn_date}{c.upi_handle ? ` · ${c.upi_handle}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--green)' }}>
                            +₹{Number(c.amount).toLocaleString('en-IN')}
                          </span>
                          <button
                            style={s.unlinkBtn}
                            onClick={() => handleUnlink(c)}
                            disabled={saving}
                            title="Unlink this recovery"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Unlinked credits */}
            {unlinkedCredits.length > 0 && (
              <div style={s.field}>
                <div style={s.label}>LINK A RECOVERY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {unlinkedCredits.map(c => {
                    const name = c.upi_merchant_raw || c.upi_note || c.raw_description?.slice(0, 30) || '—'
                    return (
                      <div key={c.id} style={s.unlinkableRow}>
                        <div style={s.linkedLeft}>
                          <div style={s.linkedName}>{name}</div>
                          <div style={s.linkedMeta}>{c.txn_date}{c.upi_handle ? ` · ${c.upi_handle}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--green)' }}>
                            +₹{Number(c.amount).toLocaleString('en-IN')}
                          </span>
                          <button
                            style={s.linkBtn}
                            onClick={() => handleLink(c)}
                            disabled={saving}
                          >
                            LINK
                          </button>
                          <button
                            style={s.multiLinkBtn}
                            onClick={() => handleOpenMultiLink(c)}
                            disabled={saving}
                            title="Split this payment across multiple splits"
                          >
                            ÷
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {unlinkedCredits.length === 0 && linkedCredits.length === 0 && (
              <div style={s.hint}>
                No credits flagged yet. Mark incoming credits as split in Transactions, then come back.
              </div>
            )}

            {error && <div style={s.error}>{error}</div>}

            <button
              style={{ ...s.resolveBtn, opacity: saving ? 0.5 : 1 }}
              onClick={handleResolveClick}
              disabled={saving}
            >
              {saving ? '...' : 'DONE — RESOLVE SPLIT →'}
            </button>
          </div>
        )}
      </Card>
    </>
  )
}

// ── Review Card ────────────────────────────────────────────────────────────────
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
  form:            { display: 'flex', flexDirection: 'column', gap: '12px' },
  field:           { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:           { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)' },
  preview:         { display: 'flex', justifyContent: 'space-between', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px' },
  progressBox:     { background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '0' },
  linkedRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)' },
  unlinkableRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)' },
  linkedLeft:      { flex: 1, minWidth: 0 },
  linkedName:      { fontSize: '12px', fontWeight: 600, marginBottom: '2px' },
  linkedMeta:      { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)' },
  linkBtn:         { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', flexShrink: 0 },
  multiLinkBtn:    { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: '3px', padding: '3px 7px', cursor: 'pointer', flexShrink: 0, title: 'Split across multiple splits' },
  unlinkBtn:       { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 },
  hint:            { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', lineHeight: 1.5, letterSpacing: '0.04em' },
  input:           { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%' },
  row:             { marginBottom: '12px' },
  select:          { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px' },
  merchantSection: { background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  checkRow:        { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
  checkbox:        { accentColor: 'var(--amber)', width: '14px', height: '14px', cursor: 'pointer' },
  checkLabel:      { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.05em' },
  nameInput:       { width: '100%', background: 'var(--bg2)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: 'var(--text)', fontSize: '13px' },
  btn:             { width: '100%', background: 'var(--amber)', color: '#000', fontWeight: 700, fontSize: '11px', letterSpacing: '0.1em', padding: '11px', borderRadius: 'var(--radius-sm)', transition: 'opacity 0.15s', cursor: 'pointer', border: 'none' },
  resolveBtn:      { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '9px', letterSpacing: '0.1em', padding: '11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  error:           { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' },
  empty:           { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '80px 0' },
  tick:            { fontSize: '28px', color: 'var(--green)' },
  emptyText:       { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', letterSpacing: '0.12em' },

  // Modal
  modalOverlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal:           { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '24px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' },
  modalTitle:      { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--amber)', fontWeight: 700 },
  modalBody:       { fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 },
  modalActions:    { display: 'flex', flexDirection: 'column', gap: '8px' },
  modalAbsorb:     { background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' },
  modalIgnore:     { background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '12px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', fontFamily: 'var(--font-mono)' },
  modalSub:        { fontSize: '9px', fontWeight: 400, opacity: 0.7, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' },
  modalCancel:     { background: 'none', border: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', cursor: 'pointer', textAlign: 'center', padding: '4px' },

  // Multi-split allocator
  allocRow:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 10px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)' },
  allocDesc:       { fontSize: '12px', fontWeight: 600, marginBottom: '2px' },
  allocOwed:       { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)' },
  allocInputWrap:  { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
  allocRupee:      { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)' },
  allocInput:      { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '3px', padding: '5px 8px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font-mono)', width: '80px', textAlign: 'right' },
  allocSummary:    { display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '8px 0', borderTop: '1px solid var(--border)' },
  allocRemaining:  { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginTop: '-4px' },
}