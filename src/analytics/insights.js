import { filterByDateRange, filterSpendable, totalSpend, topMerchants } from './spend'
import { getMonthRange, getCurrentWeekRange, getLastWeekRange } from './trends'

export function generateInsights(txns) {
  const insights = []

  const currWeek      = getCurrentWeekRange()
  const lastWeek      = getLastWeekRange()
  const currWeekSpend = totalSpend(filterByDateRange(txns, currWeek.from, currWeek.to))
  const lastWeekSpend = totalSpend(filterByDateRange(txns, lastWeek.from, lastWeek.to))

  if (lastWeekSpend > 0) {
    const delta = currWeekSpend - lastWeekSpend
    const pct   = Math.round(Math.abs(delta) / lastWeekSpend * 100)
    insights.push({
      type:      'week_over_week',
      title:     delta > 0 ? `Spending up ${pct}% vs last week` : `Spending down ${pct}% vs last week`,
      subtitle:  `₹${fmt(currWeekSpend)} this week vs ₹${fmt(lastWeekSpend)} last week`,
      sentiment: delta > 0 ? 'bad' : 'good',
    })
  }

  const curr     = getMonthRange(0)
  const currTxns = filterByDateRange(txns, curr.from, curr.to)
  const top      = topMerchants(currTxns, 1)
  if (top.length > 0) {
    insights.push({
      type:      'top_merchant',
      title:     `${top[0].name} is your top spend`,
      subtitle:  `₹${fmt(top[0].amount)} this month`,
      sentiment: 'neutral',
    })
  }

  const spendable = filterSpendable(currTxns)
  const avgTx     = spendable.length > 0
    ? spendable.reduce((s, t) => s + Number(t.amount), 0) / spendable.length : 0
  const large     = spendable
    .filter(tx => Number(tx.amount) > avgTx * 3 && Number(tx.amount) > 500)
    .sort((a, b) => b.amount - a.amount)[0]

  if (large) {
    const label = large.upi_note || large.upi_merchant_raw || 'A transaction'
    insights.push({
      type:      'large_transaction',
      title:     `${label} was unusually large`,
      subtitle:  `₹${fmt(large.amount)} — ${Math.round(Number(large.amount) / avgTx)}× your average`,
      sentiment: 'neutral',
    })
  }

  const foodSpend       = spendable.filter(tx => tx.categories?.parent?.name === 'FOOD').reduce((s, tx) => s + Number(tx.amount), 0)
  const totalMonthSpend = totalSpend(currTxns)
  if (totalMonthSpend > 0 && Math.round((foodSpend / totalMonthSpend) * 100) > 35) {
    insights.push({
      type:      'food_heavy',
      title:     `Food is ${Math.round((foodSpend / totalMonthSpend) * 100)}% of your spending`,
      subtitle:  `₹${fmt(foodSpend)} on food this month`,
      sentiment: 'bad',
    })
  }

  return insights
}

function fmt(n) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}