import { useState, useMemo } from 'react'
import { filterByDateRange } from '@/analytics/spend'
import Card from '@/components/Card'
import TxnRow from '@/components/TxnRow'
import Loader from '@/components/Loader'

const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN')

export default function Transactions({ txns = [], loading }) {
  const [search, setSearch] = useState('')
  const [direction, setDir] = useState('all')
  const [catFilter, setCat] = useState('all')

  const childCats = useMemo(() => {
    const map = {}
    txns.forEach(tx => { if (tx.categories) map[tx.category_id] = tx.categories.name })
    return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [txns])

  const filtered = useMemo(() => txns.filter(tx => {
    if (direction !== 'all' && tx.direction !== direction) return false
    if (catFilter === 'uncategorized' && tx.category_id) return false
    if (catFilter !== 'all' && catFilter !== 'uncategorized' && String(tx.category_id) !== catFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const label = (tx.upi_note || tx.upi_merchant_raw || tx.raw_description || '').toLowerCase()
      if (!label.includes(q)) return false
    }
    return true
  }), [txns, direction, catFilter, search])

  const total = useMemo(() =>
    filtered.reduce((s, tx) => tx.direction === 'debit' ? s - Number(tx.amount) : s + Number(tx.amount), 0)
  , [filtered])

  if (loading) return <Loader />

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>Transactions</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: total >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {total >= 0 ? '+' : ''}{fmt(total)}
        </div>
      </div>

      <div style={s.filters}>
        <input style={s.search} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.select} value={direction} onChange={e => setDir(e.target.value)}>
          <option value="all">All</option>
          <option value="debit">Debits</option>
          <option value="credit">Credits</option>
        </select>
        <select style={s.select} value={catFilter} onChange={e => setCat(e.target.value)}>
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {childCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Card>
        <div style={s.count}>{filtered.length} TRANSACTIONS</div>
        {filtered.length === 0
          ? <div style={s.empty}>No transactions match.</div>
          : filtered.map((tx, i) => <TxnRow key={tx.id} tx={tx} last={i === filtered.length - 1} />)
        }
      </Card>
    </div>
  )
}

const s = {
  page:    { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:   { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  search:  { flex: 1, minWidth: '140px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text)', fontSize: '13px' },
  select:  { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font-mono)' },
  count:   { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)', marginBottom: '4px' },
  empty:   { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)', padding: '32px 0', textAlign: 'center' },
}