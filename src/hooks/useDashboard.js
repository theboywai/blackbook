import { useMemo } from 'react'
import { filterByDateRange, totalSpend, totalIncome, netFlow, spendByCategoryFlat, topMerchants, dailyAverage } from '@/analytics/spend'
import { getMonthRange, getCurrentWeekRange, weeklySpendHistory, comparePeriods, getLastWeekRange } from '@/analytics/trends'
import { budgetProgress, projectedMonthlySpend, safeToSpendToday, monthProgress } from '@/analytics/budget'
import { generateInsights } from '@/analytics/insights'

export function useDashboard(txns, budgetMap, { includeOneTime = false } = {}) {
  return useMemo(() => {
    if (!txns.length || !budgetMap || !Object.keys(budgetMap).length) return null

    const opts      = { includeOneTime }
    const currMonth = getMonthRange(0)
    const currWeek  = getCurrentWeekRange()
    const lastWeek  = getLastWeekRange()
    const progress  = monthProgress()

    const monthTxns = filterByDateRange(txns, currMonth.from, currMonth.to)
    const weekTxns  = filterByDateRange(txns, currWeek.from, currWeek.to)

    return {
      monthLabel:    currMonth.label,
      weekLabel:     currWeek.label,
      monthSpend:    totalSpend(monthTxns, opts),
      monthIncome:   totalIncome(monthTxns),
      monthNet:      netFlow(monthTxns, opts),
      weekSpend:     totalSpend(weekTxns, opts),
      weekComparison: comparePeriods(txns, currWeek, lastWeek),
      categoryChart: spendByCategoryFlat(monthTxns, opts),
      weeklyHistory: weeklySpendHistory(txns, 6),
      budgets:       budgetProgress(txns, budgetMap, opts),
      projection:    projectedMonthlySpend(txns, budgetMap, opts),
      safeToday:     safeToSpendToday(txns, budgetMap, opts),
      monthProgress: progress,
      insights:      generateInsights(txns),
      topMerchants:  topMerchants(monthTxns, 5, opts),
      dailyAvg:      dailyAverage(monthTxns, progress.elapsed, opts),
    }
  }, [txns, budgetMap, includeOneTime])
}