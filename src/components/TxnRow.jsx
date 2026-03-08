const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export default function TxnRow({ tx, last }) {
  const label    = tx.upi_note || tx.upi_merchant_raw || tx.raw_description?.slice(0, 40) || '—'
  const isCredit = tx.direction === 'credit'
  const catName  = tx.categories?.name || (tx.is_internal_transfer ? 'Self Transfer' : null)

  return (
    <div style={{ ...s.row, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={s.left}>
        <div style={s.label}>{label}</div>
        <div style={s.meta}>
          {tx.txn_date} · {catName
            ? <span>{catName}</span>
            : <span style={{ color: 'var(--amber)' }}>Uncategorized</span>
          }
        </div>
      </div>
      <div style={{ ...s.amount, color: isCredit ? 'var(--green)' : 'var(--text)' }}>
        {isCredit ? '+' : '-'}{fmt(tx.amount)}
      </div>
    </div>
  )
}

const s = {
  row:    { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' },
  left:   { flex: 1, minWidth: 0 },
  label:  { fontSize: '13px', fontWeight: 600, marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta:   { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.03em' },
  amount: { fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' },
}