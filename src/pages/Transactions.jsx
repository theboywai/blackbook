import { useState, useMemo, useEffect } from 'react'
import { resolveParent } from '@/analytics/spend'
import { createManualTransaction } from '@/data/transactions'
import { fetchOwnAccounts } from '@/data/accounts'
import { fetchCategories } from '@/data/categories'
import Card from '@/components/Card'
import TxnRow from '@/components/TxnRow'
import Loader from '@/components/Loader'

const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN')

const EMPTY_FORM = {
  txn_date:        new Date().toISOString().slice(0, 10),
  amount:          '',
  direction:       'debit',
  upi_merchant_raw: '',
  raw_description: '',
  category_id:     '',
  account_id:      '',
}

export default function Transactions({ txns = [], loading, onUpdated }) {
  const [search, setSearch]     = useState('')
  const [direction, setDir]     = useState('all')
  const [catFilter, setCat]     = useState('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [accounts, setAccounts] = useState([])
  const [cats, setCats]         = useState([])
  const [saving, setSaving]     = useState(false)
  const [saveErr, setSaveErr]   = useState(null)

  useEffect(() => {
    fetchOwnAccounts().then(accs => {
      setAccounts(accs)
      if (accs.length === 1) setForm(f => ({ ...f, account_id: accs[0].id }))
    })
    fetchCategories().then(setCats)
  }, [])

  // ── Category groups for filter dropdown ───────────────────────────────────
  const categoryGroups = useMemo(() => {
    const parents = {}
    txns.forEach(tx => {
      if (!tx.categories) return
      const parent = resolveParent(tx) || 'OTHER'
      if (!parents[parent]) parents[parent] = new Map()
      parents[parent].set(String(tx.category_id), tx.categories.name)
    })
    return Object.entries(parents)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parent, childMap]) => ({
        parent,
        children: [...childMap.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [txns])

  const selectedParentChildIds = useMemo(() => {
    if (!catFilter.startsWith('parent:')) return null
    const name  = catFilter.replace('parent:', '')
    const group = categoryGroups.find(g => g.parent === name)
    return group ? new Set(group.children.map(c => c.id)) : null
  }, [catFilter, categoryGroups])

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return txns.filter(tx => {
      if (direction !== 'all' && tx.direction !== direction) return false
      if (catFilter === 'uncategorized') {
        if (tx.category_id) return false
      } else if (catFilter !== 'all') {
        if (catFilter.startsWith('parent:')) {
          if (!selectedParentChildIds?.has(String(tx.category_id))) return false
        } else {
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

  // ── Save manual transaction ───────────────────────────────────────────────
  async function handleSave() {
    if (!form.amount || !form.txn_date || !form.account_id) return
    setSaving(true)
    setSaveErr(null)
    try {
      const name = form.upi_merchant_raw.trim()
      // Auto-set is_internal_transfer for Self Transfer / Third Party Transfer categories
      const selectedCat = cats.find(c => String(c.id) === String(form.category_id))
      const isTransfer  = selectedCat?.name === 'Self Transfer' || selectedCat?.name === 'Third Party Transfer'
      await createManualTransaction({
        ...form,
        amount:               parseFloat(form.amount),
        upi_merchant_raw:     name || null,
        raw_description:      form.raw_description.trim() || name || 'Manual entry',
        category_id:          form.category_id || null,
        is_internal_transfer: isTransfer,
      })
      setShowAdd(false)
      setForm({ ...EMPTY_FORM, account_id: form.account_id }) // keep last account
      onUpdated?.()
    } catch (e) {
      setSaveErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const canSave = form.amount && form.txn_date && form.account_id && !saving

  if (loading) return <Loader />

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>Transactions</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: total >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {total >= 0 ? '+' : ''}{fmt(total)}
          </div>
          <button style={s.addBtn} onClick={() => setShowAdd(o => !o)}>
            {showAdd ? '✕' : '+ ADD'}
          </button>
        </div>
      </div>

      {/* Manual add form */}
      {showAdd && (
        <Card>
          <div style={s.formTitle}>NEW TRANSACTION</div>
          <div style={s.formGrid}>

            {/* Account */}
            <div style={s.field}>
              <div style={s.fieldLabel}>ACCOUNT</div>
              <div style={s.accountRow}>
                {accounts.map(acc => {
                  const isCash   = acc.bank?.toUpperCase() === 'CASH'
                  const label    = isCash ? '💵 CASH' : `${acc.bank?.toUpperCase()} XX${acc.account_no}`
                  const selColor = isCash ? 'var(--green)' : 'var(--amber)'
                  const selBg    = isCash ? 'var(--green-bg)' : 'var(--amber-bg)'
                  const isActive = form.account_id === acc.id
                  return (
                    <button
                      key={acc.id}
                      style={{ ...s.accountChip, borderColor: isActive ? selColor : 'var(--border2)', color: isActive ? selColor : 'var(--text2)', background: isActive ? selBg : 'transparent' }}
                      onClick={() => set('account_id', acc.id)}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Direction */}
            <div style={s.field}>
              <div style={s.fieldLabel}>TYPE</div>
              <div style={s.accountRow}>
                {['debit', 'credit'].map(d => (
                  <button
                    key={d}
                    style={{ ...s.accountChip, borderColor: form.direction === d ? (d === 'debit' ? 'var(--red)' : 'var(--green)') : 'var(--border2)', color: form.direction === d ? (d === 'debit' ? 'var(--red)' : 'var(--green)') : 'var(--text2)', background: form.direction === d ? (d === 'debit' ? 'var(--red-bg)' : 'var(--green-bg)') : 'transparent' }}
                    onClick={() => set('direction', d)}
                  >
                    {d === 'debit' ? '↑ DEBIT' : '↓ CREDIT'}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + Date row */}
            <div style={s.twoCol}>
              <div style={s.field}>
                <div style={s.fieldLabel}>AMOUNT (₹)</div>
                <input
                  style={s.input}
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                />
              </div>
              <div style={s.field}>
                <div style={s.fieldLabel}>DATE</div>
                <input
                  style={s.input}
                  type="date"
                  value={form.txn_date}
                  onChange={e => set('txn_date', e.target.value)}
                />
              </div>
            </div>

            {/* Merchant name */}
            <div style={s.field}>
              <div style={s.fieldLabel}>MERCHANT / NAME</div>
              <input
                style={s.input}
                type="text"
                placeholder="e.g. Das Food, Uber, Akash"
                value={form.upi_merchant_raw}
                onChange={e => set('upi_merchant_raw', e.target.value)}
              />
            </div>

            {/* Category */}
            <div style={s.field}>
              <div style={s.fieldLabel}>CATEGORY</div>
              <select style={s.select} value={form.category_id} onChange={e => set('category_id', e.target.value)}>
                <option value="">Uncategorized</option>
              {(() => {
                const parents  = cats.filter(c => !c.parent_id)
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

            {/* Note */}
            <div style={s.field}>
              <div style={s.fieldLabel}>NOTE (optional)</div>
              <input
                style={s.input}
                type="text"
                placeholder="Any additional context"
                value={form.raw_description}
                onChange={e => set('raw_description', e.target.value)}
              />
            </div>

          </div>

          {saveErr && (
            <div style={s.errBox}>{saveErr}</div>
          )}

          <div style={s.formActions}>
            <button style={s.cancelBtn} onClick={() => { setShowAdd(false); setSaveErr(null) }}>Cancel</button>
            <button
              style={{ ...s.saveBtn, opacity: canSave ? 1 : 0.4 }}
              onClick={handleSave}
              disabled={!canSave}
            >
              {saving ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div style={s.filters}>
        <input style={s.search} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.sel} value={direction} onChange={e => setDir(e.target.value)}>
          <option value="all">All</option>
          <option value="debit">Debits</option>
          <option value="credit">Credits</option>
        </select>
        <select style={s.sel} value={catFilter} onChange={e => setCat(e.target.value)}>
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {categoryGroups.map(({ parent, children }) => (
            <optgroup key={parent} label={parent}>
              <option value={`parent:${parent}`}>All {parent}</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <Card>
        <div style={s.count}>{filtered.length} TRANSACTIONS</div>
        {filtered.length === 0
          ? <div style={s.empty}>No transactions match.</div>
          : filtered.map((tx, i) => <TxnRow key={tx.id} tx={tx} last={i === filtered.length - 1} onUpdated={onUpdated} />)
        }
      </Card>
    </div>
  )
}

const s = {
  page:       { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:      { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  addBtn:     { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer' },

  formTitle:  { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text3)', marginBottom: '16px' },
  formGrid:   { display: 'flex', flexDirection: 'column', gap: '16px' },
  field:      { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)' },
  twoCol:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  accountRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  accountChip:{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid', cursor: 'pointer', transition: 'all 0.15s', background: 'transparent' },
  input:      { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', width: '100%' },
  select:     { background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font-mono)', width: '100%' },
  errBox:     { marginTop: '12px', padding: '10px 12px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)' },
  formActions:{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' },
  cancelBtn:  { background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', padding: '8px 16px', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)' },
  saveBtn:    { background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', padding: '8px 20px', borderRadius: 'var(--radius-sm)', transition: 'opacity 0.15s' },

  filters:    { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  search:     { flex: 1, minWidth: '140px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text)', fontSize: '13px' },
  sel:        { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: '12px', fontFamily: 'var(--font-mono)' },
  count:      { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--text3)', marginBottom: '4px' },
  empty:      { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text2)', padding: '32px 0', textAlign: 'center' },
}