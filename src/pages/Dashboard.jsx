import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '@/hooks/useDashboard'
import { CATEGORY_COLORS } from '@/constants/categories'
import KPICard from '@/components/KPICard'
import Card from '@/components/Card'
import { CategoryBarChart, WeeklyBarChart } from '@/components/SpendChart'
import InsightCard from '@/components/InsightCard'
import TxnRow from '@/components/TxnRow'
import Loader from '@/components/Loader'

const fmt  = n => '₹' + Math.round(n).toLocaleString('en-IN')
const sign = n => (n >= 0 ? '+' : '') + fmt(n)

const INFO = {
  safeToday:    'How much you can spend today without blowing your monthly budget. Calculated as: (total budget remaining this month) ÷ (days left in month).',
  category:     'Your debit spend this month grouped by parent category. Internal transfers and credits are excluded. Tap a bar to see the breakdown.',
  weekly:       'Your total spendable spend per week for the last 6 weeks. The brightest bar is the current week. Useful for spotting lifestyle creep.',
  budget:       'Your monthly budget limits vs actual spend so far. Set in Settings. Warning kicks in at 80%, red at 100%.',
  insights:     'Auto-generated observations from your transaction patterns — week-over-week changes, top merchant, unusually large transactions, and category skew.',
  topMerchants: 'The 5 places you spent the most money with this month, ranked by total amount — not frequency. One big purchase counts more than many small ones.',
}

export default function Dashboard({ txns = [], budgetMap = {}, loading, reviewCount }) {
  const [includeOneTime, setIncludeOneTime] = useState(false)
  const data = useDashboard(txns, budgetMap, { includeOneTime })

  if (loading) return <Loader />
  if (!data)   return <Loader text="NO DATA YET — RUN AN UPLOAD" />

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.period}>{data.monthLabel}</div>
          <div style={s.title}>Overview</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          {reviewCount > 0 && (
            <Link to="/review" style={s.reviewBadge}>{reviewCount} TO REVIEW →</Link>
          )}
          <OneTimeToggle value={includeOneTime} onChange={setIncludeOneTime} />
        </div>
      </div>

      {/* Month KPIs */}
      <div style={s.kpiRow}>
        <KPICard label="SPENT"  value={fmt(data.monthSpend)}  color="var(--red)"   sub={`₹${data.dailyAvg}/day avg`} />
        <KPICard label="INCOME" value={fmt(data.monthIncome)} color="var(--green)" sub="credits excl. transfers" />
        <KPICard label="NET"    value={sign(data.monthNet)}   color={data.monthNet >= 0 ? 'var(--green)' : 'var(--red)'} sub="income minus spend" />
      </div>

      {/* Safe to spend today */}
      <Card info={INFO.safeToday}>
        <div style={s.safeRow}>
          <div>
            <div style={s.safeLabel}>SAFE TO SPEND TODAY</div>
            <div style={s.safeValue}>{fmt(data.safeToday)}</div>
          </div>
          <div style={s.progressWrap}>
            <div style={s.progressMeta}>{data.monthProgress.elapsed} of {data.monthProgress.total} days elapsed</div>
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: `${data.monthProgress.percent}%` }} />
            </div>
            <div style={s.progressMeta}>
              Budget {fmt(data.projection.budget)} · Projected {fmt(data.projection.projected)}
            </div>
          </div>
        </div>
      </Card>

      {/* Spend by category */}
      {data.categoryChart.length > 0 && (
        <Card title="SPEND BY CATEGORY" info={INFO.category}>
          <CategoryBarChart data={data.categoryChart} />
          <div style={s.catList}>
            {data.categoryChart.map(cat => (
              <div key={cat.name} style={s.catRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: CATEGORY_COLORS[cat.name] || '#444', flexShrink: 0 }} />
                  <span style={s.catName}>{cat.name}</span>
                </div>
                <div style={s.catRight}>
                  <div style={s.catBar}>
                    <div style={{ ...s.catBarFill, width: `${Math.round(cat.amount / data.categoryChart[0].amount * 100)}%`, background: CATEGORY_COLORS[cat.name] || '#444' }} />
                  </div>
                  <span style={s.catAmt}>{fmt(cat.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weekly history */}
      <Card title="WEEKLY SPEND" info={INFO.weekly}>
        <WeeklyBarChart data={data.weeklyHistory} />
        {data.weekComparison.deltaPercent !== null && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: data.weekComparison.direction === 'up' ? 'var(--red)' : 'var(--green)', marginTop: '8px' }}>
            {data.weekComparison.direction === 'up' ? '↑' : '↓'} {Math.abs(data.weekComparison.deltaPercent)}% vs last week
          </div>
        )}
      </Card>

      {/* Budget progress */}
      {data.budgets.length > 0 && (
        <Card title="BUDGET" info={INFO.budget}>
          <div style={s.budgetList}>
            {data.budgets.map(b => (
              <div key={b.category} style={s.budgetRow}>
                <div style={s.budgetLeft}>
                  <span style={s.budgetCat}>{b.category}</span>
                  <span style={{ ...s.budgetStatus, color: b.status === 'over' ? 'var(--red)' : b.status === 'warning' ? 'var(--amber)' : 'var(--text3)' }}>
                    {b.status === 'over' ? 'OVER' : b.status === 'warning' ? 'WARN' : ''}
                  </span>
                </div>
                <div style={s.budgetBar}>
                  <div style={{ ...s.budgetFill, width: `${Math.min(b.percentUsed, 100)}%`, background: b.status === 'over' ? 'var(--red)' : b.status === 'warning' ? 'var(--amber)' : 'var(--green)' }} />
                </div>
                <span style={s.budgetAmt}>{fmt(b.spent)} <span style={{ color: 'var(--text3)' }}>/ {fmt(b.budget)}</span></span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <Card title="INSIGHTS" info={INFO.insights}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </div>
        </Card>
      )}

      {/* Top merchants */}
      {data.topMerchants.length > 0 && (
        <Card title="TOP MERCHANTS" info={INFO.topMerchants}>
          {data.topMerchants.map((m, i) => (
            <div key={m.name} style={{ ...s.merchantRow, borderBottom: i === data.topMerchants.length - 1 ? 'none' : '1px solid var(--border)' }}>
              <span style={s.merchantRank}>{i + 1}</span>
              <span style={s.merchantName}>{m.name}</span>
              <span style={s.merchantAmt}>{fmt(m.amount)}</span>
            </div>
          ))}
        </Card>
      )}

    </div>
  )
}

const s = {
  page:         { display: 'flex', flexDirection: 'column', gap: '14px' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' },
  period:       { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text2)', letterSpacing: '0.12em', marginBottom: '4px' },
  title:        { fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' },
  reviewBadge:  { background: 'var(--amber)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', padding: '7px 13px', borderRadius: 'var(--radius-sm)' },
  kpiRow:       { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' },
  safeRow:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  safeLabel:    { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text2)', marginBottom: '6px' },
  safeValue:    { fontFamily: 'var(--font-mono)', fontSize: '26px', color: 'var(--green)', fontWeight: 500 },
  progressWrap: { flex: 1, minWidth: '160px' },
  progressMeta: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text3)', marginBottom: '6px' },
  progressBar:  { height: '4px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' },
  progressFill: { height: '100%', background: 'var(--amber)', borderRadius: '2px' },
  catList:      { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' },
  catRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  catName:      { fontSize: '12px', fontWeight: 600 },
  catRight:     { display: 'flex', alignItems: 'center', gap: '12px' },
  catBar:       { width: '60px', height: '3px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden' },
  catBarFill:   { height: '100%', borderRadius: '2px' },
  catAmt:       { fontFamily: 'var(--font-mono)', fontSize: '12px', minWidth: '70px', textAlign: 'right' },
  budgetList:   { display: 'flex', flexDirection: 'column', gap: '12px' },
  budgetRow:    { display: 'grid', gridTemplateColumns: '1fr 80px 120px', alignItems: 'center', gap: '12px' },
  budgetLeft:   { display: 'flex', alignItems: 'center', gap: '8px' },
  budgetCat:    { fontSize: '12px', fontWeight: 600 },
  budgetStatus: { fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em' },
  budgetBar:    { height: '3px', background: 'var(--border2)', borderRadius: '2px', overflow: 'hidden' },
  budgetFill:   { height: '100%', borderRadius: '2px' },
  budgetAmt:    { fontFamily: 'var(--font-mono)', fontSize: '11px', textAlign: 'right' },
  merchantRow:  { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' },
  merchantRank: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text3)', width: '16px' },
  merchantName: { flex: 1, fontSize: '13px', fontWeight: 600 },
  merchantAmt:  { fontFamily: 'var(--font-mono)', fontSize: '12px' },
}

function OneTimeToggle({ value, onChange }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}
      onClick={() => onChange(v => !v)}
    >
      <div style={{ width: '26px', height: '14px', borderRadius: '7px', background: value ? 'var(--amber)' : 'var(--border2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: '2px', left: '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: value ? 'translateX(12px)' : 'translateX(0)' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: value ? 'var(--amber)' : 'var(--text3)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        {value ? 'INCL. ONE-TIME' : 'EXC. ONE-TIME'}
      </span>
    </div>
  )
}