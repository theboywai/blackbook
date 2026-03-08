import { useCorpus } from '@/hooks/useCorpus'
import { useBudgets } from '@/hooks/useBudgets'
import { budgetProgress, projectedMonthlySpend, safeToSpendToday, monthProgress } from '@/analytics/budget'
import { useLastUpload } from '@/hooks/useLastUpload'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/constants/categories'
import Card from '@/components/Card'
import Loader from '@/components/Loader'

const fmt  = n => '₹' + Math.round(n).toLocaleString('en-IN')
const sign = n => (n >= 0 ? '+' : '') + fmt(n)

const BANK_COLORS = {
  KOTAK: '#f5a623',
  HDFC:  '#5b8dee',
}

const INFO = {
  corpus:    'Your total known cash across both accounts — sum of the closing balances from your most recent upload for each account. Updates every time you run an upload.',
  account:   'Per-account breakdown: closing balance (last upload), income received this month, and spend debited from this account.',
  mtd:       'Month-to-date totals across both accounts combined. Income = credits excluding transfers. Spent = debits excluding transfers.',
  budget:    'Your monthly budget limits vs actual spend so far. Tap any category in Settings to change the limit. Warning at 80%, red at 100%.',
  safe:      'How much you can spend today and still finish the month within budget. Formula: (total budget remaining) ÷ (days left in month).',
  projected: 'If you keep spending at your current daily rate, this is what your month-end total will be. Compared against your total monthly budget.',
}

export default function Budget({ txns = [], loading: txnLoading }) {
  const { data: corpus, loading: corpusLoading } = useCorpus(txns)
  const { budgets, budgetMap, loading: budgetLoading } = useBudgets()
  const { label: syncLabel, urgency } = useLastUpload()

  const loading = txnLoading || corpusLoading || budgetLoading

  const progress   = monthProgress()
  const budgetRows = Object.keys(budgetMap).length ? budgetProgress(txns, budgetMap) : []
  const projection = Object.keys(budgetMap).length ? projectedMonthlySpend(txns, budgetMap) : null
  const safeToday  = Object.keys(budgetMap).length ? safeToSpendToday(txns, budgetMap) : null

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
        {syncLabel && (
          <div style={{ ...s.syncBadge, color: urgencyColor[urgency] || 'var(--text3)' }}>
            SYNCED {syncLabel.toUpperCase()}
          </div>
        )}
      </div>

      {/* Total corpus */}
      <Card info={INFO.corpus}>
        <div style={s.corpusRow}>
          <div>
            <div style={s.corpusLabel}>TOTAL CORPUS</div>
            <div style={s.corpusValue}>
              {corpus ? fmt(corpus.corpus) : '—'}
            </div>
            <div style={s.corpusSub}>cash across all accounts</div>
          </div>
          {corpus && (
            <div style={s.corpusBars}>
              {corpus.summaries.map(s2 => {
                const pct = corpus.corpus > 0
                  ? Math.round((s2.closingBalance || 0) / corpus.corpus * 100)
                  : 0
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
              const hasData = s2.closingBalance !== null
              return (
                <div key={s2.account.id} style={{ ...s.accountCard, borderColor: color + '33' }}>
                  <div style={s.accountHeader}>
                    <div style={{ ...s.accountDot, background: color }} />
                    <div>
                      <div style={s.accountBank}>{bank}</div>
                      <div style={s.accountNo}>XX{s2.account.account_no}</div>
                    </div>
                  </div>

                  <div style={s.accountBalance}>
                    {hasData ? fmt(s2.closingBalance) : '—'}
                  </div>
                  <div style={s.accountBalanceLabel}>CLOSING BALANCE</div>

                  <div style={s.accountStats}>
                    <div style={s.accountStat}>
                      <div style={{ ...s.accountStatVal, color: 'var(--green)' }}>
                        {s2.income > 0 ? fmt(s2.income) : '—'}
                      </div>
                      <div style={s.accountStatLabel}>INCOME MTD</div>
                    </div>
                    <div style={s.accountStat}>
                      <div style={{ ...s.accountStatVal, color: 'var(--red)' }}>
                        {s2.spent > 0 ? fmt(s2.spent) : '—'}
                      </div>
                      <div style={s.accountStatLabel}>SPENT MTD</div>
                    </div>
                    <div style={s.accountStat}>
                      <div style={{ ...s.accountStatVal, color: s2.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {sign(s2.net)}
                      </div>
                      <div style={s.accountStatLabel}>NET MTD</div>
                    </div>
                  </div>

                  {!hasData && (
                    <div style={s.noUpload}>No upload yet</div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Combined MTD */}
      {corpus && (
        <Card title="MONTH TO DATE · ALL ACCOUNTS" info={INFO.mtd}>
          <div style={s.mtdRow}>
            <MTDStat label="INCOME"  value={fmt(corpus.mtd.income)} color="var(--green)" />
            <div style={s.divider} />
            <MTDStat label="SPENT"   value={fmt(corpus.mtd.spent)}  color="var(--red)" />
            <div style={s.divider} />
            <MTDStat label="NET"     value={sign(corpus.mtd.net)}   color={corpus.mtd.net >= 0 ? 'var(--green)' : 'var(--red)'} />
          </div>
          <div style={s.progressSection}>
            <div style={s.progressMeta}>
              Day {progress.elapsed} of {progress.total} · {progress.remaining} days remaining
            </div>
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: `${progress.percent}%` }} />
            </div>
          </div>
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
                {projection.willExceedBy > 0
                  ? `${fmt(projection.willExceedBy)} over budget`
                  : `${fmt(Math.abs(projection.willExceedBy))} under budget`
                }
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
              const color = b.status === 'over' ? 'var(--red)' : b.status === 'warning' ? 'var(--amber)' : 'var(--green)'
              const icon  = CATEGORY_ICONS[b.category] || '•'
              return (
                <div key={b.category} style={s.budgetRow}>
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
                    <div style={s.budgetBarWrap}>
                      <div style={{ ...s.budgetBarFill, width: `${Math.min(b.percentUsed, 100)}%`, background: color }} />
                    </div>
                    <span style={s.budgetNums}>
                      {fmt(b.spent)}
                      <span style={{ color: 'var(--text3)' }}> / {fmt(b.budget)}</span>
                    </span>
                    <span style={{ ...s.budgetPct, color }}>
                      {b.percentUsed}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={s.budgetTotal}>
            <span style={s.budgetTotalLabel}>TOTAL BUDGET REMAINING</span>
            <span style={{ ...s.budgetTotalVal, color: budgetRows.reduce((s, b) => s + b.remaining, 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt(Math.abs(budgetRows.reduce((s, b) => s + b.remaining, 0)))}
              {budgetRows.reduce((s, b) => s + b.remaining, 0) < 0 ? ' over' : ' left'}
            </span>
          </div>
        </Card>
      )}

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

// Corpus bar styles (named cs to avoid conflict with s)
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
  syncBadge:         { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', marginTop: '8px' },

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
  progressSection:   {},
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

  budgetList:        { display: 'flex', flexDirection: 'column', gap: '14px' },
  budgetRow:         { display: 'flex', flexDirection: 'column', gap: '6px' },
  budgetLeft:        { display: 'flex', alignItems: 'center', gap: '8px' },
  budgetIcon:        { fontSize: '14px' },
  budgetCat:         { fontSize: '12px', fontWeight: 700, flex: 1 },
  budgetTag:         { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', padding: '2px 6px', borderRadius: '4px', border: '1px solid' },
  budgetRight:       { display: 'flex', alignItems: 'center', gap: '10px' },
  budgetBarWrap:     { flex: 1, height: '4px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden' },
  budgetBarFill:     { height: '100%', borderRadius: '2px', transition: 'width 0.4s ease' },
  budgetNums:        { fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'nowrap' },
  budgetPct:         { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, width: '36px', textAlign: 'right' },
  budgetTotal:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border2)' },
  budgetTotalLabel:  { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text2)', letterSpacing: '0.1em' },
  budgetTotalVal:    { fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 600 },
}