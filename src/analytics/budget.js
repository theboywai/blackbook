import { filterByDateRange, totalSpend, spendByParentCategory } from './spend'
import { getMonthRange } from './trends'

export function monthProgress() {
  const now       = new Date()
  const end       = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const elapsed   = now.getDate()
  const total     = end.getDate()
  return { elapsed, total, remaining: total - elapsed, percent: Math.round((elapsed / total) * 100) }
}

export function budgetProgress(txns, budgetMap) {
  const curr   = getMonthRange(0)
  const bycat  = Object.fromEntries(
    spendByParentCategory(filterByDateRange(txns, curr.from, curr.to)).map(c => [c.name, c.amount])
  )
  return Object.entries(budgetMap).map(([category, budget]) => {
    const spent       = bycat[category] || 0
    const percentUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0
    return {
      category,
      spent:       Math.round(spent),
      budget,
      remaining:   Math.round(budget - spent),
      percentUsed,
      status:      percentUsed >= 100 ? 'over' : percentUsed >= 80 ? 'warning' : 'ok',
    }
  }).sort((a, b) => b.percentUsed - a.percentUsed)
}

export function projectedMonthlySpend(txns, budgetMap) {
  const { elapsed, total } = monthProgress()
  const curr        = getMonthRange(0)
  const spent       = totalSpend(filterByDateRange(txns, curr.from, curr.to))
  const dailyRate   = elapsed > 0 ? spent / elapsed : 0
  const projected   = Math.round(dailyRate * total)
  const totalBudget = Object.values(budgetMap).reduce((s, b) => s + b, 0)
  return { projected, budget: totalBudget, willExceedBy: projected - totalBudget, dailyRate: Math.round(dailyRate) }
}

export function safeToSpendToday(txns, budgetMap) {
  const { remaining } = monthProgress()
  const curr          = getMonthRange(0)
  const spent         = totalSpend(filterByDateRange(txns, curr.from, curr.to))
  const totalBudget   = Object.values(budgetMap).reduce((s, b) => s + b, 0)
  return remaining > 0 ? Math.round((totalBudget - spent) / remaining) : 0
}