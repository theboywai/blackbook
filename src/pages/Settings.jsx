import { useState } from 'react'
import { useBudgets } from '@/hooks/useBudgets'
import { CATEGORY_COLORS, CATEGORY_ICONS, SPENDABLE_PARENTS } from '@/constants/categories'
import Card from '@/components/Card'
import Loader from '@/components/Loader'

export default function Settings() {
  const { budgets, loading, saving, error, save } = useBudgets()

  if (loading) return <Loader />

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)

  return (
    <div style={s.page}>
      <div style={s.title}>Settings</div>

      <Card title="MONTHLY BUDGETS">
        <p style={s.hint}>Tap any amount to edit. Saves instantly.</p>
        <div style={s.list}>
          {budgets
            .filter(b => SPENDABLE_PARENTS.includes(b.category))
            .map(b => (
              <BudgetRow key={b.category} budget={b} saving={saving[b.category]} onSave={save} />
            ))
          }
        </div>
        <div style={s.total}>
          <span style={s.totalLabel}>TOTAL MONTHLY BUDGET</span>
          <span style={s.totalValue}>₹{totalBudget.toLocaleString('en-IN')}</span>
        </div>
      </Card>

      {error && <div style={s.error}>{error}</div>}

      <Card title="ABOUT">
        {[
          ['VERSION', '0.1.0'],
          ['DATA SOURCE', 'Supabase + Gemini Flash'],
          ['ANALYTICS', 'Frontend — offline capable'],
          ['PIPELINE', 'Local Node.js script'],
        ].map(([label, value]) => (
          <div key={label} style={s.aboutRow}>
            <span style={s.aboutLabel}>{label}</span>
            <span style={s.aboutValue}>{value}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

function BudgetRow({ budget, saving, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(budget.amount))
  const color = CATEGORY_COLORS[budget.category] || '#555'
  const icon  = CATEGORY_ICONS[budget.category]  || '•'

  function handleBlur() {
    setEditing(false)
    const parsed = parseInt(val, 10)
    if (!isNaN(parsed) && parsed !== budget.amount) onSave(budget.category, parsed)
    else setVal(String(budget.amount))
  }

  function handleKey(e) {
    if (e.key === 'Enter')  e.target.blur()
    if (e.key === 'Escape') { setVal(String(budget.amount)); setEditing(false) }
  }

  return (
    <div style={s.row}>
      <div style={s.rowLeft}>
        <div style={{ ...s.dot, background: color }} />
        <span style={s.icon}>{icon}</span>
        <span style={s.catName}>{budget.category}</span>
      </div>
      <div style={s.rowRight}>
        {saving ? (
          <span style={s.savingText}>SAVING...</span>
        ) : editing ? (
          <div style={s.inputWrap}>
            <span style={s.rupee}>₹</span>
            <input
              style={s.input}
              type="number"
              value={val}
              onChange={e => setVal(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKey}
              autoFocus
              min={0}
            />
          </div>
        ) : (
          <button style={s.amountBtn} onClick={() => setEditing(true)}>
            ₹{Number(budget.amount).toLocaleString('en-IN')}
            <span style={s.editHint}>EDIT</span>
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  page:       { display: 'flex', flexDirection: 'column', gap: '14px' },
  title:      { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' },
  hint:       { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.05em', marginBottom: '20px' },
  list:       { display: 'flex', flexDirection: 'column' },
  row:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' },
  rowLeft:    { display: 'flex', alignItems: 'center', gap: '10px' },
  dot:        { width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0 },
  icon:       { fontSize: '14px' },
  catName:    { fontSize: '13px', fontWeight: 600 },
  rowRight:   { display: 'flex', alignItems: 'center' },
  amountBtn:  { display: 'flex', alignItems: 'center', gap: '10px', background: 'none', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid transparent' },
  editHint:   { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.1em' },
  inputWrap:  { display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg3)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '5px 10px' },
  rupee:      { fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text2)' },
  input:      { background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--amber)', width: '90px', textAlign: 'right' },
  savingText: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.1em' },
  total:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border2)' },
  totalLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.1em' },
  totalValue: { fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 500, color: 'var(--amber)' },
  error:      { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', padding: '12px', background: 'var(--red-bg)', borderRadius: 'var(--radius-sm)' },
  aboutRow:   { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  aboutLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.08em' },
  aboutValue: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)' },
}