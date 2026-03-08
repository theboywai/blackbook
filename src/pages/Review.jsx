import { useReview } from '@/hooks/useReview'
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
            <ReviewCard key={tx.id} tx={tx} categories={categories} onSave={saveCategory} saving={saving[tx.id]} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({ tx, categories, onSave, saving }) {
  const label    = tx.upi_note || tx.upi_merchant_raw || tx.raw_description?.slice(0, 50) || '—'
  const isCredit = tx.direction === 'credit'

  return (
    <Card>
      <div style={s.top}>
        <div style={s.left}>
          <div style={s.txLabel}>{label}</div>
          <div style={s.txMeta}>{tx.txn_date} · {tx.raw_description?.slice(0, 55)}</div>
        </div>
        <div style={{ ...s.amount, color: isCredit ? 'var(--green)' : 'var(--text)', flexShrink: 0 }}>
          {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
        </div>
      </div>
      <div style={s.bottom}>
        <select style={s.select} defaultValue="" onChange={e => e.target.value && onSave(tx.id, e.target.value)} disabled={saving}>
          <option value="" disabled>Select category...</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {saving && <span style={s.saving}>SAVING...</span>}
      </div>
    </Card>
  )
}

const s = {
  page:      { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:     { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  badge:     { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-bg)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--amber-dim)' },
  list:      { display: 'flex', flexDirection: 'column', gap: '10px' },
  top:       { display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '14px' },
  left:      { flex: 1, minWidth: 0 },
  txLabel:   { fontSize: '14px', fontWeight: 700, marginBottom: '4px' },
  txMeta:    { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  amount:    { fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 500 },
  bottom:    { display: 'flex', alignItems: 'center', gap: '12px' },
  select:    { flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px' },
  saving:    { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.1em' },
  empty:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '80px 0' },
  tick:      { fontSize: '28px', color: 'var(--green)' },
  emptyText: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text2)', letterSpacing: '0.12em' },
}