import { useMemo } from 'react'
import { filterByDateRange, totalSpend, totalIncome, netFlow, spendByCategoryFlat, topMerchants, dailyAverage } from '@/analytics/spend'
import { getMonthRange, getCurrentWeekRange, weeklySpendHistory, comparePeriods, getLastWeekRange } from '@/analytics/trends'
import { budgetProgress, projectedMonthlySpend, safeToSpendToday, monthProgress } from '@/analytics/budget'
import { generateInsights } from '@/analytics/insights'

export function useDashboard(txns, budgetMap) {
  return useMemo(() => {
    if (!txns || !txns.length || !budgetMap || !Object.keys(budgetMap).length) return null

    const currMonth = getMonthRange(0)
    const currWeek  = getCurrentWeekRange()
    const lastWeek  = getLastWeekRange()
    const progress  = monthProgress()
    const monthTxns = filterByDateRange(txns, currMonth.from, currMonth.to)
    const weekTxns  = filterByDateRange(txns, currWeek.from, currWeek.to)

    return {
      monthLabel:     currMonth.label,
      monthSpend:     totalSpend(monthTxns),
      monthIncome:    totalIncome(monthTxns),
      monthNet:       netFlow(monthTxns),
      weekSpend:      totalSpend(weekTxns),
      weekComparison: comparePeriods(txns, currWeek, lastWeek),
      categoryChart:  spendByCategoryFlat(monthTxns),
      weeklyHistory:  weeklySpendHistory(txns, 6),
      budgets:        budgetProgress(txns, budgetMap),
      projection:     projectedMonthlySpend(txns, budgetMap),
      safeToday:      safeToSpendToday(txns, budgetMap),
      monthProgress:  progress,
      insights:       generateInsights(txns),
      topMerchants:   topMerchants(monthTxns, 5),
      dailyAvg:       dailyAverage(monthTxns, progress.elapsed),
    }
  }, [txns, budgetMap])
}