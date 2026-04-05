import { useMemo } from 'react'
import { filterByDateRange, totalSpend, totalIncome, netFlow, spendByCategoryFlat, topMerchants, dailyAverage } from '@/analytics/spend'
import { getMonthRange, getCurrentWeekRange, weeklySpendHistory, comparePeriods, getLastWeekRange } from '@/analytics/trends'
import { budgetProgress, projectedMonthlySpend, safeToSpendToday, monthProgress } from '@/analytics/budget'
import { generateInsights } from '@/analytics/insights'

export function useDashboard(txns, budgetMap, { includeOneTime = false } = {}) {
  return useMemo(() => {
    if (!txns.length) return null

    const opts      = { includeOneTime }
    const currMonth = getMonthRange(0)
    const currWeek  = getCurrentWeekRange()
    const lastWeek  = getLastWeekRange()
    const progress  = monthProgress()

    const monthTxns = filterByDateRange(txns, currMonth.from, currMonth.to)
    const weekTxns  = filterByDateRange(txns, currWeek.from, currWeek.to)

    const hasBudgets = budgetMap && Object.keys(budgetMap).length > 0
    const hasCurrentMonth = monthTxns.length > 0

    return {
      monthLabel:      currMonth.label,
      weekLabel:       currWeek.label,
      monthSpend:      totalSpend(monthTxns, opts),
      monthIncome:     totalIncome(monthTxns),
      monthNet:        netFlow(monthTxns, opts),
      weekSpend:       totalSpend(weekTxns, opts),
      weekComparison:  comparePeriods(txns, currWeek, lastWeek),
      categoryChart:   spendByCategoryFlat(monthTxns, opts),
      weeklyHistory:   weeklySpendHistory(txns, 6),
      budgets:         hasBudgets ? budgetProgress(txns, budgetMap, opts) : [],
      projection:      hasBudgets ? projectedMonthlySpend(txns, budgetMap, opts) : null,
      safeToday:       hasBudgets ? safeToSpendToday(txns, budgetMap, opts) : 0,
      monthProgress:   progress,
      insights:        generateInsights(txns),
      topMerchants:    topMerchants(monthTxns, 5, opts),
      dailyAvg:        dailyAverage(monthTxns, progress.elapsed, opts),
      hasCurrentMonth,
      hasBudgets,
    }
  }, [txns, budgetMap, includeOneTime])
}