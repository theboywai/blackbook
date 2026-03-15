import { SPENDABLE_PARENTS, INCOME_PARENTS } from '@/constants/categories'

// Resolve the top-level parent name for a transaction's category.
// If the category has no parent_id, the category itself is the parent (top-level).
export function resolveParent(tx) {
  const cat = tx.categories
  if (!cat) return null
  if (cat.parent_id === null || cat.parent_id === undefined) return cat.name
  return cat.parent?.name || null
}

// ── Filters ───────────────────────────────────────────────────────────────────

export function filterByDateRange(txns, from, to) {
  return txns.filter(tx => tx.txn_date >= from && tx.txn_date <= to)
}

export function filterDebits(txns) {
  return txns.filter(tx => tx.direction === 'debit' && !tx.is_internal_transfer)
}

export function filterCredits(txns) {
  return txns.filter(tx => tx.direction === 'credit' && !tx.is_internal_transfer)
}

/**
 * Core spend filter.
 * @param {boolean} includeOneTime - if false (default), excludes is_one_time transactions
 */
export function filterSpendable(txns, { includeOneTime = false } = {}) {
  return txns.filter(tx => {
    if (tx.direction !== 'debit' || tx.is_internal_transfer) return false
    if (!includeOneTime && tx.is_one_time) return false
    const parent = resolveParent(tx)
    return !parent || SPENDABLE_PARENTS.includes(parent)
  })
}

// ── Totals ────────────────────────────────────────────────────────────────────

export function totalAmount(txns) {
  return txns.reduce((sum, tx) => sum + Number(tx.amount), 0)
}

export function totalSpend(txns, opts) {
  return totalAmount(filterSpendable(txns, opts))
}

export function totalIncome(txns) {
  return totalAmount(filterCredits(txns))
}

export function netFlow(txns, opts) {
  return totalIncome(txns) - totalSpend(txns, opts)
}

// ── Group by category ─────────────────────────────────────────────────────────

export function spendByParentCategory(txns, opts) {
  const spendable = filterSpendable(txns, opts)
  const parentMap = {}

  spendable.forEach(tx => {
    const child  = tx.categories?.name || 'Other'
    const parent = resolveParent(tx) || 'OTHER'
    const amt    = Number(tx.amount)

    if (!parentMap[parent]) parentMap[parent] = { name: parent, amount: 0, children: {} }
    parentMap[parent].amount += amt

    if (!parentMap[parent].children[child]) parentMap[parent].children[child] = 0
    parentMap[parent].children[child] += amt
  })

  return Object.values(parentMap)
    .map(p => ({
      name:     p.name,
      amount:   Math.round(p.amount),
      children: Object.entries(p.children)
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function spendByCategoryFlat(txns, opts) {
  return spendByParentCategory(txns, opts).map(({ name, amount }) => ({ name, amount }))
}

// ── Daily spend ───────────────────────────────────────────────────────────────

export function dailySpend(txns, opts) {
  const spendable = filterSpendable(txns, opts)
  const dayMap    = {}

  spendable.forEach(tx => {
    dayMap[tx.txn_date] = (dayMap[tx.txn_date] || 0) + Number(tx.amount)
  })

  return Object.entries(dayMap)
    .map(([date, amount]) => ({ date, amount: Math.round(amount) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function dailyAverage(txns, days, opts) {
  const spend = totalSpend(txns, opts)
  return days > 0 ? Math.round(spend / days) : 0
}

// ── Top merchants ─────────────────────────────────────────────────────────────

export function topMerchants(txns, limit = 5, opts) {
  const spendable = filterSpendable(txns, opts)
  const map       = {}

  spendable.forEach(tx => {
    const name = tx.merchants?.display_name || tx.upi_merchant_raw || 'Unknown'
    map[name]  = (map[name] || 0) + Number(tx.amount)
  })

  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}