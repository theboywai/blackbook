import { filterByDateRange, totalSpend, spendByParentCategory } from './spend'
import { getMonthRange } from './trends'

export function monthProgress() {
  const now       = new Date()
  const end       = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const elapsed   = now.getDate()
  const total     = end.getDate()
  const remaining = total - elapsed
  return { elapsed, total, remaining, percent: Math.round((elapsed / total) * 100) }
}

export function budgetProgress(txns, budgetMap, opts = {}, monthOffset = 0) {
  const curr     = getMonthRange(monthOffset)
  const prev     = getMonthRange(monthOffset - 1)
  const currTxns = filterByDateRange(txns, curr.from, curr.to)
  const prevTxns = filterByDateRange(txns, prev.from, prev.to)
  const bycat     = Object.fromEntries(
    spendByParentCategory(currTxns, opts).map(c => [c.name, c.amount])
  )
  const bycatPrev = Object.fromEntries(
    spendByParentCategory(prevTxns, opts).map(c => [c.name, c.amount])
  )

  return Object.entries(budgetMap).map(([category, budget]) => {
    const spent       = bycat[category] || 0
    const lastMonth   = bycatPrev[category] || 0
    const remaining   = budget - spent
    const percentUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0
    const status      = percentUsed >= 100 ? 'over' : percentUsed >= 80 ? 'warning' : 'ok'
    return { category, spent: Math.round(spent), lastMonth: Math.round(lastMonth), budget, remaining: Math.round(remaining), percentUsed, status }
  }).sort((a, b) => b.percentUsed - a.percentUsed)
}

export function projectedMonthlySpend(txns, budgetMap, opts = {}) {
  const { elapsed, total } = monthProgress()
  const curr       = getMonthRange(0)
  const currTxns   = filterByDateRange(txns, curr.from, curr.to)
  const spent      = totalSpend(currTxns, opts)
  const dailyRate  = elapsed > 0 ? spent / elapsed : 0
  const projected  = Math.round(dailyRate * total)
  const totalBudget = Object.values(budgetMap).reduce((s, b) => s + b, 0)
  return { projected, budget: totalBudget, willExceedBy: projected - totalBudget, dailyRate: Math.round(dailyRate) }
}

export function safeToSpendToday(txns, budgetMap, opts = {}) {
  const { remaining } = monthProgress()
  const curr          = getMonthRange(0)
  const currTxns      = filterByDateRange(txns, curr.from, curr.to)
  const spent         = totalSpend(currTxns, opts)
  const totalBudget   = Object.values(budgetMap).reduce((s, b) => s + b, 0)
  const budgetLeft    = totalBudget - spent
  return remaining > 0 ? Math.round(budgetLeft / remaining) : 0
}