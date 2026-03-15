import { filterByDateRange, totalSpend, totalIncome } from './spend'
import { getMonthRange } from './trends'

/**
 * Per-account analytics — all pure functions.
 * Takes txns array (already enriched), accounts array, closingBalances map.
 */

/**
 * Break down transactions by account_id
 */
export function txnsByAccount(txns) {
  const map = {}
  txns.forEach(tx => {
    if (!map[tx.account_id]) map[tx.account_id] = []
    map[tx.account_id].push(tx)
  })
  return map
}

/**
 * For each account, compute this month's spend, income, net
 * Returns [{ account, spent, income, net, closingBalance }]
 */
export function accountSummaries(txns, accounts, closingBalances, lastUploads = {}) {
  const curr       = getMonthRange(0)
  const monthTxns  = filterByDateRange(txns, curr.from, curr.to)
  const byAccount  = txnsByAccount(monthTxns)

  return accounts.map(acc => {
    const accTxns    = byAccount[acc.id] || []
    const spent      = totalSpend(accTxns)
    const income     = totalIncome(accTxns)
    const closing    = closingBalances[acc.id] ?? null
    const lastUpload = lastUploads[acc.id] ?? null

    return {
      account:        acc,
      spent:          Math.round(spent),
      income:         Math.round(income),
      net:            Math.round(income - spent),
      closingBalance: closing,
      lastUpload,      // { uploaded_at, period_end } or null
    }
  })
}

/**
 * Total corpus = sum of all known closing balances
 */
export function totalCorpus(closingBalances) {
  return Object.values(closingBalances).reduce((s, b) => s + (b || 0), 0)
}

/**
 * Month-to-date across all accounts
 */
export function totalMTD(txns) {
  const curr      = getMonthRange(0)
  const monthTxns = filterByDateRange(txns, curr.from, curr.to)
  return {
    spent:  Math.round(totalSpend(monthTxns)),
    income: Math.round(totalIncome(monthTxns)),
    net:    Math.round(totalIncome(monthTxns) - totalSpend(monthTxns)),
  }
}