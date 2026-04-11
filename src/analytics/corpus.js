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
export function accountSummaries(txns, accounts, lastUploads = {}) {
  const curr      = getMonthRange(0)
  const monthTxns = filterByDateRange(txns, curr.from, curr.to)
  const byAccount = txnsByAccount(monthTxns)

  return accounts.map(acc => {
    const accTxns    = byAccount[acc.id] || []
    const spent      = totalSpend(accTxns)
    const income     = totalIncome(accTxns)
    const lastUpload = lastUploads[acc.id] ?? null

    return {
      account:  acc,
      spent:    Math.round(spent),
      income:   Math.round(income),
      net:      Math.round(income - spent),
      balance:  acc.balance ?? null,
      lastUpload,
    }
  })
}

/**
 * Total corpus = sum of all known closing balances
 */
export function totalCorpus(accounts) {
  return accounts.reduce((s, acc) => s + (Number(acc.balance) || 0), 0)
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

/**
 * Build daily corpus timeline from transactions.
 * For each day, take the last balance_after per account, sum across accounts.
 * Returns [{ date: 'YYYY-MM-DD', corpus: number }] sorted ascending.
 */
export function corpusTimeline(txns) {
  if (!txns.length) return []

  // All txns in the array are already own-account — just need balance_after
  const relevant = txns
    .filter(tx => tx.balance_after != null)
    // Sort ascending by date, then by created_at within same date
    // so the last entry per account per day is the most recent one
    .sort((a, b) => {
      const dateCompare = a.txn_date.localeCompare(b.txn_date)
      if (dateCompare !== 0) return dateCompare
      // created_at tiebreak — earlier created_at first so later ones overwrite
      if (a.created_at && b.created_at) return a.created_at.localeCompare(b.created_at)
      return 0
    })

  if (!relevant.length) return []

  // Get all unique dates
  const allDates = [...new Set(relevant.map(tx => tx.txn_date))].sort()
  const lastBalance = {} // accountId → balance (last seen for this date)
  const points = []

  for (const date of allDates) {
    // Update last known balance for each account on this date
    const dayTxns = relevant.filter(tx => tx.txn_date === date)
    // Already sorted by created_at within date — last one per account wins
    dayTxns.forEach(tx => {
      lastBalance[tx.account_id] = Number(tx.balance_after)
    })

    const total = Object.values(lastBalance).reduce((s, b) => s + b, 0)
    if (total > 0) points.push({ date, corpus: Math.round(total) })
  }

  return points
}