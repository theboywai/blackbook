import { useState, useMemo } from 'react'
import { resolveParent } from '@/analytics/spend'
import Card from '@/components/Card'
import TxnRow from '@/components/TxnRow'
import Loader from '@/components/Loader'

const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN')

export default function Transactions({ txns = [], loading }) {
  const [search, setSearch] = useState('')
  const [direction, setDir] = useState('all')
  const [catFilter, setCat] = useState('all')

  // Build grouped category structure from actual txns
  // { parentName: [{ id, name }] }
  const categoryGroups = useMemo(() => {
    const parents = {}   // parentName → Set of child { id, name }

    txns.forEach(tx => {
      if (!tx.categories) return
      const cat    = tx.categories
      const parent = resolveParent(tx) || 'OTHER'

      if (!parents[parent]) parents[parent] = new Map()

      // Always add the actual category as a child entry
      parents[parent].set(String(tx.category_id), cat.name)
    })

    // Sort parents alphabetically, children alphabetically within
    return Object.entries(parents)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parent, childMap]) => ({
        parent,
        children: [...childMap.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [txns])

  // Set of all child category IDs under the selected parent
  const selectedParentChildIds = useMemo(() => {
    if (catFilter === 'all' || catFilter === 'uncategorized') return null
    // Check if it's a parent-level filter (prefixed with "parent:")
    if (catFilter.startsWith('parent:')) {
      const parentName = catFilter.replace('parent:', '')
      const group = categoryGroups.find(g => g.parent === parentName)
      return group ? new Set(group.children.map(c => c.id)) : null
    }
    return null // it's a specific child id
  }, [catFilter, categoryGroups])

  const filtered = useMemo(() => {
    return txns.filter(tx => {
      if (direction !== 'all' && tx.direction !== direction) return false

      if (catFilter === 'uncategorized') {
        if (tx.category_id) return false
      } else if (catFilter !== 'all') {
        if (catFilter.startsWith('parent:')) {
          // Parent selected — match any child under it
          if (!selectedParentChildIds?.has(String(tx.category_id))) return false
        } else {
          // Specific child selected
          if (String(tx.category_id) !== catFilter) return false
        }
      }

      if (search) {
        const q     = search.toLowerCase()
        const label = (tx.upi_note || tx.upi_merchant_raw || tx.raw_description || '').toLowerCase()
        if (!label.includes(q)) return false
      }

      return true
    })
  }, [txns, direction, catFilter, search, selectedParentChildIds])

  const total = useMemo(() => filtered.reduce((s, tx) =>
    tx.direction === 'debit' ? s - Number(tx.amount) : s + Number(tx.amount), 0
  ), [filtered])

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
        <input
          style={s.search}
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.select} value={direction} onChange={e => setDir(e.target.value)}>
          <option value="all">All</option>
          <option value="debit">Debits</option>
          <option value="credit">Credits</option>
        </select>
        <select style={s.select} value={catFilter} onChange={e => setCat(e.target.value)}>
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {categoryGroups.map(({ parent, children }) => (
            <optgroup key={parent} label={parent}>
              {/* Parent option — selects all children */}
              <option value={`parent:${parent}`}>All {parent}</option>
              {/* Individual children */}
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
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