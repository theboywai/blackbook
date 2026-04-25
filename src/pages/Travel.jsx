import { useState, useEffect, useMemo } from 'react'
import { useTrips } from '@/hooks/useTrips'
import { createTrip, updateTrip, deleteTrip, fetchTripTransactions } from '@/data/trips'
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/constants/categories'
import Card from '@/components/Card'
import Loader from '@/components/Loader'

const fmt  = n => '₹' + Math.round(n).toLocaleString('en-IN')
const fmtK = n => n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : fmt(n)

const EMPTY_FORM = { name: '', destination: '', start_date: '', end_date: '', budget: '' }

export default function Travel() {
  const { trips, loading, refresh } = useTrips()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [saveErr, setSaveErr]       = useState(null)
  const [openTrip, setOpenTrip]     = useState(null) // trip id with expanded detail

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleCreate() {
    if (!form.name.trim()) { setSaveErr('Trip name is required'); return }
    setSaving(true); setSaveErr(null)
    try {
      await createTrip({
        name:        form.name.trim(),
        destination: form.destination.trim() || null,
        start_date:  form.start_date || null,
        end_date:    form.end_date   || null,
        budget:      form.budget ? Number(form.budget) : null,
      })
      setForm(EMPTY_FORM)
      setShowCreate(false)
      await refresh()
    } catch (e) { setSaveErr(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(tripId) {
    if (!confirm('Remove this trip? Transactions will be untagged.')) return
    try { await deleteTrip(tripId); await refresh() }
    catch (e) { alert(e.message) }
  }

  if (loading) return <Loader />

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>Travel</div>
        <button style={s.addBtn} onClick={() => setShowCreate(o => !o)}>
          {showCreate ? '✕' : '+ NEW TRIP'}
        </button>
      </div>

      {/* Create trip form */}
      {showCreate && (
        <Card>
          <div style={s.formTitle}>NEW TRIP</div>
          <div style={s.formGrid}>
            <div style={s.field}>
              <div style={s.label}>TRIP NAME *</div>
              <input style={s.input} placeholder="e.g. Goa April" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div style={s.field}>
              <div style={s.label}>DESTINATION</div>
              <input style={s.input} placeholder="e.g. Goa" value={form.destination} onChange={e => set('destination', e.target.value)} />
            </div>
            <div style={s.twoCol}>
              <div style={s.field}>
                <div style={s.label}>START DATE</div>
                <input style={s.input} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div style={s.field}>
                <div style={s.label}>END DATE</div>
                <input style={s.input} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>
            <div style={s.field}>
              <div style={s.label}>BUDGET (₹) — optional</div>
              <input style={s.input} type="number" placeholder="Total trip budget" value={form.budget} onChange={e => set('budget', e.target.value)} />
            </div>
          </div>
          {saveErr && <div style={s.errBox}>{saveErr}</div>}
          <div style={s.formActions}>
            <button style={s.cancelBtn} onClick={() => { setShowCreate(false); setSaveErr(null) }}>Cancel</button>
            <button style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }} onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : 'Create Trip →'}
            </button>
          </div>
        </Card>
      )}

      {/* No trips state */}
      {trips.length === 0 && !showCreate && (
        <div style={s.empty}>
          <div style={{ fontSize: '28px' }}>✈️</div>
          <div style={s.emptyText}>NO TRIPS YET</div>
          <div style={s.emptyHint}>Create a trip, then select transactions in the TXN tab to tag them.</div>
        </div>
      )}

      {/* Trip cards */}
      {trips.map(trip => (
        <TripCard
          key={trip.id}
          trip={trip}
          isOpen={openTrip === trip.id}
          onToggle={() => setOpenTrip(id => id === trip.id ? null : trip.id)}
          onDelete={() => handleDelete(trip.id)}
          onUpdated={refresh}
        />
      ))}
    </div>
  )
}

// ── Trip Card ──────────────────────────────────────────────────────────────────
function TripCard({ trip, isOpen, onToggle, onDelete, onUpdated }) {
  const [txns, setTxns]       = useState([])
  const [txnLoading, setTxnLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({
    name:        trip.name,
    destination: trip.destination || '',
    start_date:  trip.start_date  || '',
    end_date:    trip.end_date    || '',
    budget:      trip.budget      || '',
  })
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setTxnLoading(true)
    fetchTripTransactions(trip.id)
      .then(setTxns)
      .finally(() => setTxnLoading(false))
  }, [isOpen, trip.id])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleUpdate() {
    setSaving(true)
    try {
      await updateTrip(trip.id, {
        name:        form.name.trim(),
        destination: form.destination.trim() || null,
        start_date:  form.start_date || null,
        end_date:    form.end_date   || null,
        budget:      form.budget ? Number(form.budget) : null,
      })
      setEditing(false)
      await onUpdated()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  // Analytics on trip transactions
  const stats = useMemo(() => {
    const debits = txns.filter(t => t.direction === 'debit')
    const total  = debits.reduce((s, t) => s + Number(t.amount), 0)

    // Spend by parent category
    const byParent = {}
    debits.forEach(t => {
      const parent = t.categories?.parent_id == null
        ? t.categories?.name
        : null // need parent name — use category name as fallback
      const key = t.categories?.name || 'Other'
      byParent[key] = (byParent[key] || 0) + Number(t.amount)
    })

    const days = trip.start_date && trip.end_date
      ? Math.max(1, Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000) + 1)
      : null

    return { total, byParent, days, perDay: days ? total / days : null }
  }, [txns, trip])

  const budgetPct = trip.budget ? Math.min(100, (stats.total / Number(trip.budget)) * 100) : null
  const overBudget = trip.budget && stats.total > Number(trip.budget)

  const dateLabel = trip.start_date
    ? `${trip.start_date}${trip.end_date ? ` → ${trip.end_date}` : ''}`
    : null

  return (
    <Card>
      {/* Trip header — always visible */}
      <div style={s.tripTop} onClick={onToggle}>
        <div style={s.tripLeft}>
          <div style={s.tripName}>✈️ {trip.name}</div>
          {trip.destination && <div style={s.tripMeta}>{trip.destination}</div>}
          {dateLabel && <div style={s.tripMeta}>{dateLabel}{stats.days ? ` · ${stats.days}d` : ''}</div>}
        </div>
        <div style={s.tripRight}>
          {txns.length > 0 && (
            <div style={s.tripTotal}>{fmt(stats.total)}</div>
          )}
          <div style={{ color: 'var(--text3)', fontSize: '12px' }}>{isOpen ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Budget bar */}
      {budgetPct !== null && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.1em' }}>
              BUDGET
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: overBudget ? 'var(--red)' : 'var(--text2)' }}>
              {fmt(stats.total)} / {fmt(Number(trip.budget))}
            </span>
          </div>
          <div style={s.budgetTrack}>
            <div style={{ ...s.budgetFill, width: `${budgetPct}%`, background: overBudget ? 'var(--red)' : 'var(--amber)' }} />
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {isOpen && (
        <div style={s.detail}>
          {txnLoading ? (
            <div style={s.txnLoading}>Loading transactions...</div>
          ) : txns.length === 0 ? (
            <div style={s.noTxns}>
              No transactions tagged yet. Go to TXN tab, long-press any transaction to select, then tap "ADD TO TRIP".
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div style={s.statsRow}>
                <div style={s.statBox}>
                  <div style={s.statLabel}>TOTAL SPENT</div>
                  <div style={s.statValue}>{fmt(stats.total)}</div>
                </div>
                {stats.perDay && (
                  <div style={s.statBox}>
                    <div style={s.statLabel}>PER DAY</div>
                    <div style={s.statValue}>{fmtK(stats.perDay)}</div>
                  </div>
                )}
                <div style={s.statBox}>
                  <div style={s.statLabel}>TRANSACTIONS</div>
                  <div style={s.statValue}>{txns.filter(t => t.direction === 'debit').length}</div>
                </div>
              </div>

              {/* Category breakdown */}
              <div style={s.breakdown}>
                <div style={s.breakdownTitle}>BREAKDOWN</div>
                {Object.entries(stats.byParent)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amt]) => {
                    const pct = stats.total > 0 ? (amt / stats.total) * 100 : 0
                    return (
                      <div key={cat} style={s.breakRow}>
                        <div style={s.breakLabel}>{cat}</div>
                        <div style={s.breakBar}>
                          <div style={{ ...s.breakFill, width: `${pct}%` }} />
                        </div>
                        <div style={s.breakAmt}>{fmtK(amt)}</div>
                      </div>
                    )
                  })}
              </div>

              {/* Transaction list */}
              <div style={s.txnList}>
                <div style={s.breakdownTitle}>TRANSACTIONS</div>
                {txns.map(tx => {
                  const label    = tx.upi_note || tx.upi_merchant_raw || tx.raw_description?.slice(0, 40) || '—'
                  const isCredit = tx.direction === 'credit'
                  return (
                    <div key={tx.id} style={s.txnRow}>
                      <div style={s.txnLeft}>
                        <div style={s.txnName}>{label}</div>
                        <div style={s.txnMeta}>{tx.txn_date} · {tx.categories?.name || 'Uncategorized'}</div>
                      </div>
                      <div style={{ ...s.txnAmt, color: isCredit ? 'var(--green)' : 'var(--text)' }}>
                        {isCredit ? '+' : '-'}{fmtK(Number(tx.amount))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Edit / Delete */}
          {editing ? (
            <div style={{ ...s.formGrid, marginTop: '16px' }}>
              <div style={s.twoCol}>
                <div style={s.field}>
                  <div style={s.label}>NAME</div>
                  <input style={s.input} value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div style={s.field}>
                  <div style={s.label}>DESTINATION</div>
                  <input style={s.input} value={form.destination} onChange={e => set('destination', e.target.value)} />
                </div>
              </div>
              <div style={s.twoCol}>
                <div style={s.field}>
                  <div style={s.label}>START</div>
                  <input style={s.input} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div style={s.field}>
                  <div style={s.label}>END</div>
                  <input style={s.input} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
              </div>
              <div style={s.field}>
                <div style={s.label}>BUDGET (₹)</div>
                <input style={s.input} type="number" value={form.budget} onChange={e => set('budget', e.target.value)} />
              </div>
              <div style={s.formActions}>
                <button style={s.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
                <button style={{ ...s.saveBtn, opacity: saving ? 0.5 : 1 }} onClick={handleUpdate} disabled={saving}>
                  {saving ? 'Saving...' : 'Save →'}
                </button>
              </div>
            </div>
          ) : (
            <div style={s.tripActions}>
              <button style={s.editBtn} onClick={() => setEditing(true)}>EDIT TRIP</button>
              <button style={s.deleteBtn} onClick={onDelete}>DELETE</button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

const s = {
  page:           { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:          { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  addBtn:         { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer' },

  formTitle:      { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text3)', marginBottom: '16px' },
  formGrid:       { display: 'flex', flexDirection: 'column', gap: '14px' },
  field:          { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:          { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)' },
  twoCol:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  input:          { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%' },
  errBox:         { marginTop: '12px', padding: '10px 12px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)' },
  formActions:    { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  cancelBtn:      { background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', padding: '8px 16px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' },
  saveBtn:        { background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', padding: '8px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: 'none' },

  empty:          { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0' },
  emptyText:      { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', letterSpacing: '0.12em' },
  emptyHint:      { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', textAlign: 'center', maxWidth: '260px', lineHeight: 1.6 },

  tripTop:        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '10px' },
  tripLeft:       { flex: 1 },
  tripName:       { fontSize: '15px', fontWeight: 700, marginBottom: '4px' },
  tripMeta:       { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginBottom: '2px' },
  tripRight:      { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' },
  tripTotal:      { fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text)' },

  budgetTrack:    { height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' },
  budgetFill:     { height: '100%', borderRadius: '2px', transition: 'width 0.3s' },

  detail:         { borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '16px' },
  txnLoading:     { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', textAlign: 'center', padding: '16px 0' },
  noTxns:         { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', lineHeight: 1.6, textAlign: 'center', padding: '8px 0' },

  statsRow:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  statBox:        { background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' },
  statLabel:      { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: '4px' },
  statValue:      { fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' },

  breakdown:      { display: 'flex', flexDirection: 'column', gap: '8px' },
  breakdownTitle: { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)' },
  breakRow:       { display: 'flex', alignItems: 'center', gap: '10px' },
  breakLabel:     { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', width: '110px', flexShrink: 0 },
  breakBar:       { flex: 1, height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' },
  breakFill:      { height: '100%', background: 'var(--amber)', borderRadius: '2px' },
  breakAmt:       { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', width: '48px', textAlign: 'right', flexShrink: 0 },

  txnList:        { display: 'flex', flexDirection: 'column', gap: '8px' },
  txnRow:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' },
  txnLeft:        { flex: 1, minWidth: 0 },
  txnName:        { fontSize: '13px', fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  txnMeta:        { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)' },
  txnAmt:         { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, flexShrink: 0, marginLeft: '12px' },

  tripActions:    { display: 'flex', gap: '10px' },
  editBtn:        { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '7px 14px', cursor: 'pointer' },
  deleteBtn:      { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', padding: '7px 14px', cursor: 'pointer' },
}