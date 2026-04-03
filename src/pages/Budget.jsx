import { useState, useMemo } from 'react'
import { useCorpus } from '@/hooks/useCorpus'
import { useBudgets } from '@/hooks/useBudgets'
import { budgetProgress, projectedMonthlySpend, safeToSpendToday, monthProgress } from '@/analytics/budget'
import { filterByDateRange } from '@/analytics/spend'
import { getMonthRange } from '@/analytics/trends'
import { useLastUpload } from '@/hooks/useLastUpload'
import { CATEGORY_ICONS } from '@/constants/categories'
import { useState as useLocalState } from 'react'
import { updateAccountBalance } from '@/data/accounts'
import Card from '@/components/Card'
import Loader from '@/components/Loader'

const fmt  = n => '₹' + Math.round(n).toLocaleString('en-IN')
const sign = n => (n >= 0 ? '+' : '') + fmt(n)

const BANK_COLORS = { KOTAK: '#f5a623', HDFC: '#5b8dee' }

const INFO = {
  corpus:  'Your total known cash across both accounts — sum of the closing balances from your most recent upload for each account.',
  account: 'Per-account breakdown: closing balance (last upload), income received this month, and spend debited from this account.',
  mtd:     'Month-to-date totals across both accounts combined. Income = credits excluding transfers. Spent = debits excluding transfers.',
  budget:  'Your monthly budget limits vs actual spend so far. Tap any row to see individual transactions. Warning at 80%, red at 100%.',
  safe:    'How much you can spend today and still finish the month within budget. Formula: (total budget remaining) ÷ (days left in month).',
}

export default function Budget({ txns = [], loading: txnLoading }) {
  const { data: corpus, loading: corpusLoading, refresh: refreshCorpus } = useCorpus(txns)
  const { budgetMap, loading: budgetLoading }    = useBudgets()
  const { label: syncLabel, urgency }            = useLastUpload()
  const [expandedCat, setExpandedCat]            = useState(null)
  const [includeOneTime, setIncludeOneTime]      = useState(false)

  const loading = txnLoading || corpusLoading || budgetLoading
  const opts    = { includeOneTime }

  const progress   = monthProgress()
  const budgetRows = Object.keys(budgetMap).length ? budgetProgress(txns, budgetMap, opts) : []
  const projection = Object.keys(budgetMap).length ? projectedMonthlySpend(txns, budgetMap, opts) : null
  const safeToday  = Object.keys(budgetMap).length ? safeToSpendToday(txns, budgetMap, opts) : null

  const expandedTxns = useMemo(() => {
    if (!expandedCat) return []
    const curr      = getMonthRange(0)
    const monthTxns = filterByDateRange(txns, curr.from, curr.to)
    return monthTxns.filter(tx => {
      if (tx.direction !== 'debit' || tx.is_internal_transfer) return false
      if (!includeOneTime && tx.is_one_time) return false
      const cat    = tx.categories
      const parent = cat ? (cat.parent_id == null ? cat.name : cat.parent?.name || 'OTHER') : 'OTHER'
      return parent.toUpperCase() === expandedCat.toUpperCase()
    }).sort((a, b) => b.amount - a.amount)
  }, [expandedCat, txns, includeOneTime])

  const urgencyColor = { ok: 'var(--green)', warning: 'var(--amber)', overdue: 'var(--red)' }

  if (loading) return <Loader />

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.period}>{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}</div>
          <div style={s.title}>Budget Control</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          {syncLabel && (
            <div style={{ ...s.syncBadge, color: urgencyColor[urgency] || 'var(--text3)' }}>
              {urgency === 'ok' ? `SYNCED ${syncLabel.toUpperCase()}` : urgency === 'warning' ? 'UPLOAD SOON' : 'UPLOAD NOW'}
            </div>
          )}
          <OneTimeToggle value={includeOneTime} onChange={setIncludeOneTime} />
        </div>
      </div>

      {/* Total corpus */}
      <Card info={INFO.corpus}>
        <div style={s.corpusRow}>
          <div>
            <div style={s.corpusLabel}>TOTAL CORPUS</div>
            <div style={s.corpusValue}>{corpus ? fmt(corpus.corpus) : '—'}</div>
            <div style={s.corpusSub}>cash across all accounts</div>
          </div>
          {corpus && (
            <div style={s.corpusBars}>
              {corpus.summaries.map(s2 => {
                const pct  = corpus.corpus > 0 ? Math.round((s2.balance || 0) / corpus.corpus * 100) : 0
                const bank = s2.account.bank?.toUpperCase()
                return (
                  <div key={s2.account.id} style={cs.barRow}>
                    <span style={cs.barLabel}>{bank}</span>
                    <div style={cs.barTrack}>
                      <div style={{ ...cs.barFill, width: `${pct}%`, background: BANK_COLORS[bank] || 'var(--text3)' }} />
                    </div>
                    <span style={cs.barPct}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Per-account breakdown */}
      {corpus && (
        <Card title="ACCOUNTS" info={INFO.account}>
          <div style={s.accountGrid}>
            {corpus.summaries.map(s2 => {
              const bank    = s2.account.bank?.toUpperCase()
              const color   = BANK_COLORS[bank] || 'var(--text3)'
              const hasData = s2.balance !== null
              return (
                <div key={s2.account.id} style={{ ...s.accountCard, borderColor: color + '33' }}>
                  <div style={s.accountHeader}>
                    <div style={{ ...s.accountDot, background: color }} />
                    <div>
                      <div style={s.accountBank}>{bank}</div>
                      <div style={s.accountNo}>XX{s2.account.account_no}</div>
                    </div>
                  </div>
                  <EditableBalance
                    accountId={s2.account.id}
                    balance={s2.balance}
                    onSaved={refreshCorpus}
                  />
                  <LastSynced upload={s2.lastUpload} />
                  <div style={s.accountStats}>
                    <div style={s.accountStat}>
                      <div style={{ ...s.accountStatVal, color: 'var(--green)' }}>{s2.income > 0 ? fmt(s2.income) : '—'}</div>
                      <div style={s.accountStatLabel}>INCOME MTD</div>
                    </div>
                    <div style={s.accountStat}>
                      <div style={{ ...s.accountStatVal, color: 'var(--red)' }}>{s2.spent > 0 ? fmt(s2.spent) : '—'}</div>
                      <div style={s.accountStatLabel}>SPENT MTD</div>
                    </div>
                    <div style={s.accountStat}>
                      <div style={{ ...s.accountStatVal, color: s2.net >= 0 ? 'var(--green)' : 'var(--red)' }}>{sign(s2.net)}</div>
                      <div style={s.accountStatLabel}>NET MTD</div>
                    </div>
                  </div>
                  {!hasData && <div style={s.noUpload}>No upload yet</div>}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* MTD combined */}
      {corpus && (
        <Card title="MONTH TO DATE · ALL ACCOUNTS" info={INFO.mtd}>
          <div style={s.mtdRow}>
            <MTDStat label="INCOME" value={fmt(corpus.mtd.income)} color="var(--green)" />
            <div style={s.divider} />
            <MTDStat label="SPENT"  value={fmt(corpus.mtd.spent)}  color="var(--red)" />
            <div style={s.divider} />
            <MTDStat label="NET"    value={sign(corpus.mtd.net)}   color={corpus.mtd.net >= 0 ? 'var(--green)' : 'var(--red)'} />
          </div>
          <div style={s.progressMeta}>Day {progress.elapsed} of {progress.total} · {progress.remaining} days remaining</div>
          <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${progress.percent}%` }} /></div>
        </Card>
      )}

      {/* Safe to spend + projection */}
      {safeToday !== null && projection && (
        <Card info={INFO.safe}>
          <div style={s.safeRow}>
            <div>
              <div style={s.safeLabel}>SAFE TO SPEND TODAY</div>
              <div style={s.safeValue}>{fmt(safeToday)}</div>
              <div style={s.safeSub}>per day to stay on budget</div>
            </div>
            <div style={s.projectionBox}>
              <div style={s.projLabel}>PROJECTED MONTH-END</div>
              <div style={{ ...s.projValue, color: projection.willExceedBy > 0 ? 'var(--red)' : 'var(--green)' }}>
                {fmt(projection.projected)}
              </div>
              <div style={{ ...s.projDelta, color: projection.willExceedBy > 0 ? 'var(--red)' : 'var(--green)' }}>
                {projection.willExceedBy > 0 ? `${fmt(projection.willExceedBy)} over` : `${fmt(Math.abs(projection.willExceedBy))} under`} budget
              </div>
              <div style={s.projSub}>vs {fmt(projection.budget)} total budget</div>
            </div>
          </div>
        </Card>
      )}

      {/* Budget vs actual */}
      {budgetRows.length > 0 && (
        <Card title="BUDGET VS ACTUAL" info={INFO.budget}>
          <div style={s.budgetList}>
            {budgetRows.map(b => {
              const color   = b.status === 'over' ? 'var(--red)' : b.status === 'warning' ? 'var(--amber)' : 'var(--green)'
              const icon    = CATEGORY_ICONS[b.category] || '•'
              const isOpen  = expandedCat === b.category

              return (
                <div key={b.category}>
                  <button
                    style={{ ...s.budgetRow, background: isOpen ? 'var(--bg3)' : 'transparent' }}
                    onClick={() => setExpandedCat(isOpen ? null : b.category)}
                  >
                    <div style={s.budgetTop}>
                      <div style={s.budgetLeft}>
                        <span style={s.budgetIcon}>{icon}</span>
                        <span style={s.budgetCat}>{b.category}</span>
                        {b.status !== 'ok' && (
                          <span style={{ ...s.budgetTag, color, borderColor: color + '44', background: color + '11' }}>
                            {b.status === 'over' ? 'OVER' : 'WARN'}
                          </span>
                        )}
                      </div>
                      <div style={s.budgetRight}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={s.budgetNums}>
                            {fmt(b.spent)}<span style={{ color: 'var(--text3)' }}> / {fmt(b.budget)}</span>
                          </div>
                          {b.lastMonth > 0 && (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)' }}>
                              last mo: {fmt(b.lastMonth)}
                            </div>
                          )}
                        </div>
                        <span style={{ ...s.budgetPct, color }}>{b.percentUsed}%</span>
                        <span style={{ ...s.chevron, color: 'var(--text3)', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </div>
                    </div>
                    <div style={s.budgetBarWrap}>
                      <div style={{ ...s.budgetBarFill, width: `${Math.min(b.percentUsed, 100)}%`, background: color }} />
                    </div>
                  </button>

                  {isOpen && (
                    <div style={s.expandedBox}>
                      {expandedTxns.length === 0 ? (
                        <div style={s.emptyRow}>No transactions this month</div>
                      ) : (
                        expandedTxns.map(tx => {
                          const merchant = tx.merchants?.display_name || tx.upi_merchant_raw || tx.raw_description?.slice(0, 32)
                          const subcat   = tx.categories?.name || '—'
                          return (
                            <div key={tx.id} style={s.txRow}>
                              <div style={s.txLeft}>
                                <div style={s.txMerchant}>
                                  {merchant}
                                  {tx.is_one_time && <span style={s.oneTimeBadge}>1×</span>}
                                </div>
                                <div style={s.txMeta}>{tx.txn_date} · {subcat}</div>
                              </div>
                              <div style={{ ...s.txAmount, color: tx.is_one_time ? 'var(--text3)' : 'var(--red)' }}>{fmt(tx.amount)}</div>
                            </div>
                          )
                        })
                      )}
                      <div style={s.expandedTotal}>
                        <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>TOTAL</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>{fmt(b.spent)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={s.budgetTotal}>
            <span style={s.budgetTotalLabel}>TOTAL BUDGET REMAINING</span>
            <span style={{ ...s.budgetTotalVal, color: budgetRows.reduce((sum, b) => sum + b.remaining, 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt(Math.abs(budgetRows.reduce((sum, b) => sum + b.remaining, 0)))}
              {budgetRows.reduce((sum, b) => sum + b.remaining, 0) < 0 ? ' over' : ' left'}
            </span>
          </div>
        </Card>
      )}

    </div>
  )
}

function EditableBalance({ accountId, balance, onSaved }) {
  const [editing, setEditing]   = useLocalState(false)
  const [val, setVal]           = useLocalState('')
  const [saving, setSaving]     = useLocalState(false)
  const [saveErr, setSaveErr]   = useLocalState(null)

  function startEdit() {
    setVal(balance != null ? String(balance) : '')
    setSaveErr(null)
    setEditing(true)
  }

  async function save() {
    const num = parseFloat(val)
    if (isNaN(num) || val.trim() === '') { setEditing(false); return }
    setSaving(true)
    setSaveErr(null)
    try {
      await updateAccountBalance(accountId, num)
      setEditing(false)
      onSaved?.()
    } catch (e) {
      setSaveErr(e.message)
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter')  { e.preventDefault(); save() }
    if (e.key === 'Escape') { setEditing(false) }
  }

  const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN')

  if (editing) return (
    <div style={{ marginBottom: '2px' }}>
      <input
        autoFocus
        style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, background: 'var(--bg)', border: '1px solid var(--amber)', borderRadius: '4px', padding: '2px 6px', color: 'var(--text)', width: '100%' }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={handleKeyDown}
        type="number"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--amber)' }}>
          {saving ? 'SAVING...' : 'ENTER TO SAVE · ESC TO CANCEL'}
        </div>
        <button
          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--amber)', background: 'none', letterSpacing: '0.08em' }}
          onClick={save}
          disabled={saving}
        >
          SAVE
        </button>
      </div>
      {saveErr && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--red)', marginTop: '4px' }}>{saveErr}</div>}
    </div>
  )

  return (
    <div style={{ marginBottom: '2px', cursor: 'pointer' }} onClick={startEdit} title="Tap to override balance">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 500, marginBottom: '2px' }}>
        {balance != null ? fmt(balance) : '—'}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginLeft: '6px' }}>✎</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text3)', letterSpacing: '0.12em', marginBottom: '16px' }}>BALANCE · TAP TO EDIT</div>
    </div>
  )
}

function MTDStat({ label, value, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text2)', letterSpacing: '0.12em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 500, color }}>{value}</div>
    </div>
  )
}

function OneTimeToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }} onClick={() => onChange(v => !v)}>
      <div style={{ width: '26px', height: '14px', borderRadius: '7px', background: value ? 'var(--amber)' : 'var(--border2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: '2px', left: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: value ? 'translateX(12px)' : 'translateX(0)' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: value ? 'var(--amber)' : 'var(--text3)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        {value ? 'INCL. ONE-TIME' : 'EXC. ONE-TIME'}
      </span>
    </div>
  )
}

function LastSynced({ upload }) {
  const [open, setOpen] = useState(false)

  if (!upload) return (
    <div style={ls.wrap}>
      <span style={{ ...ls.badge, color: 'var(--text3)', borderColor: 'var(--border)' }}>NEVER SYNCED</span>
    </div>
  )

  const uploadedAt = new Date(upload.uploaded_at)
  const now        = new Date()
  const diffDays   = Math.floor((now - uploadedAt) / 86400000)
  const diffHours  = Math.floor((now - uploadedAt) / 3600000)

  const ageLabel = diffHours < 1   ? 'just now'
                 : diffHours < 24  ? `${diffHours}h ago`
                 : diffDays === 1  ? 'yesterday'
                 : `${diffDays}d ago`

  const color = diffDays < 3 ? 'var(--green)' : diffDays < 7 ? 'var(--amber)' : 'var(--red)'

  const fullDate    = uploadedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const fullTime    = uploadedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const periodLabel = upload.period_end
    ? `Data through ${new Date(upload.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
    : null

  return (
    <div style={ls.wrap}>
      <button
        style={{ ...ls.badge, color, borderColor: color + '44', background: color + '0d' }}
        onClick={() => setOpen(o => !o)}
      >
        ● SYNCED {ageLabel.toUpperCase()}
      </button>
      {open && (
        <div style={ls.tooltip}>
          <div style={ls.ttRow}><span style={ls.ttLabel}>UPLOADED</span><span style={ls.ttVal}>{fullDate} {fullTime}</span></div>
          {periodLabel && <div style={ls.ttRow}><span style={ls.ttLabel}>COVERS</span><span style={ls.ttVal}>{periodLabel}</span></div>}
        </div>
      )}
    </div>
  )
}

const ls = {
  wrap:    { position: 'relative', marginBottom: '16px' },
  badge:   { background: 'none', border: '1px solid', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', padding: '3px 7px', cursor: 'pointer', transition: 'opacity 0.15s' },
  tooltip: { position: 'absolute', top: '22px', left: 0, zIndex: 200, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px' },
  ttRow:   { display: 'flex', justifyContent: 'space-between', gap: '12px' },
  ttLabel: { fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text3)', letterSpacing: '0.1em' },
  ttVal:   { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text)' },
}

const cs = {
  barRow:   { display: 'flex', alignItems: 'center', gap: '10px' },
  barLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', width: '50px' },
  barTrack: { flex: 1, height: '4px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: '2px', transition: 'width 0.5s ease' },
  barPct:   { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', width: '32px', textAlign: 'right' },
}

const s = {
  page:              { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:            { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' },
  period:            { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text2)', letterSpacing: '0.12em', marginBottom: '4px' },
  title:             { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  syncBadge:         { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em' },

  corpusRow:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' },
  corpusLabel:       { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text2)', marginBottom: '8px' },
  corpusValue:       { fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--amber)' },
  corpusSub:         { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '4px' },
  corpusBars:        { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '160px' },

  accountGrid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' },
  accountCard:       { background: 'var(--bg3)', border: '1px solid', borderRadius: 'var(--radius)', padding: '16px' },
  accountHeader:     { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  accountDot:        { width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0 },
  accountBank:       { fontSize: '13px', fontWeight: 800, letterSpacing: '0.05em' },
  accountNo:         { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' },
  accountBalance:    { fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 500, marginBottom: '2px' },
  accountBalanceLabel: { fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text3)', letterSpacing: '0.12em', marginBottom: '16px' },
  accountStats:      { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' },
  accountStat:       { display: 'flex', flexDirection: 'column', gap: '4px' },
  accountStatVal:    { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 500 },
  accountStatLabel:  { fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text3)', letterSpacing: '0.08em' },
  noUpload:          { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '8px' },

  mtdRow:            { display: 'flex', alignItems: 'center', marginBottom: '16px' },
  divider:           { width: '1px', height: '40px', background: 'var(--border)', flexShrink: 0 },
  progressMeta:      { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '6px' },
  progressBar:       { height: '4px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden' },
  progressFill:      { height: '100%', background: 'var(--amber)', borderRadius: '2px' },

  safeRow:           { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' },
  safeLabel:         { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text2)', marginBottom: '8px' },
  safeValue:         { fontFamily: 'var(--font-mono)', fontSize: '32px', color: 'var(--green)', fontWeight: 500 },
  safeSub:           { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)', marginTop: '4px' },
  projectionBox:     { background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '14px 18px', minWidth: '180px' },
  projLabel:         { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text2)', letterSpacing: '0.12em', marginBottom: '6px' },
  projValue:         { fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, marginBottom: '4px' },
  projDelta:         { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' },
  projSub:           { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text3)' },

  budgetList:        { display: 'flex', flexDirection: 'column', gap: '4px' },
  budgetRow:         { width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'left' },
  budgetTop:         { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  budgetLeft:        { display: 'flex', alignItems: 'center', gap: '8px' },
  budgetIcon:        { fontSize: '14px' },
  budgetCat:         { fontSize: '12px', fontWeight: 700 },
  budgetTag:         { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', padding: '2px 6px', borderRadius: '4px', border: '1px solid' },
  budgetRight:       { display: 'flex', alignItems: 'center', gap: '8px' },
  budgetBarWrap:     { height: '3px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden' },
  budgetBarFill:     { height: '100%', borderRadius: '2px', transition: 'width 0.4s ease' },
  budgetNums:        { fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'nowrap' },
  budgetPct:         { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, width: '34px', textAlign: 'right' },
  chevron:           { fontSize: '12px', transition: 'transform 0.2s', lineHeight: 1 },

  expandedBox:       { margin: '0 4px 8px 4px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' },
  emptyRow:          { padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', textAlign: 'center' },
  txRow:             { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' },
  txLeft:            { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 },
  txMerchant:        { fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' },
  oneTimeBadge:      { fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)', borderRadius: '3px', padding: '1px 4px', flexShrink: 0 },
  txMeta:            { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)' },
  txAmount:          { fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, flexShrink: 0, marginLeft: '12px' },
  expandedTotal:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg3)' },

  budgetTotal:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border2)' },
  budgetTotalLabel:  { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.1em' },
  budgetTotalVal:    { fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 600 },
}