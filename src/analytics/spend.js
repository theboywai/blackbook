import { SPENDABLE_PARENTS } from '@/constants/categories'

export function filterByDateRange(txns, from, to) {
  return txns.filter(tx => tx.txn_date >= from && tx.txn_date <= to)
}

export function filterDebits(txns) {
  return txns.filter(tx => tx.direction === 'debit' && !tx.is_internal_transfer)
}

export function filterCredits(txns) {
  return txns.filter(tx => tx.direction === 'credit' && !tx.is_internal_transfer)
}

export function filterSpendable(txns) {
  return txns.filter(tx => {
    if (tx.direction !== 'debit' || tx.is_internal_transfer) return false
    const parent = tx.categories?.parent?.name
    return !parent || SPENDABLE_PARENTS.includes(parent)
  })
}

export function totalAmount(txns) {
  return txns.reduce((sum, tx) => sum + Number(tx.amount), 0)
}

export function totalSpend(txns) {
  return totalAmount(filterSpendable(txns))
}

export function totalIncome(txns) {
  return totalAmount(filterCredits(txns))
}

export function netFlow(txns) {
  return totalIncome(txns) - totalSpend(txns)
}

export function spendByParentCategory(txns) {
  const spendable = filterSpendable(txns)
  const parentMap = {}

  spendable.forEach(tx => {
    const child  = tx.categories?.name || 'Other'
    const parent = tx.categories?.parent?.name || 'OTHER'
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

export function spendByCategoryFlat(txns) {
  return spendByParentCategory(txns).map(({ name, amount }) => ({ name, amount }))
}

export function dailySpend(txns) {
  const spendable = filterSpendable(txns)
  const dayMap    = {}
  spendable.forEach(tx => {
    dayMap[tx.txn_date] = (dayMap[tx.txn_date] || 0) + Number(tx.amount)
  })
  return Object.entries(dayMap)
    .map(([date, amount]) => ({ date, amount: Math.round(amount) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function dailyAverage(txns, days) {
  return days > 0 ? Math.round(totalSpend(txns) / days) : 0
}

export function topMerchants(txns, limit = 5) {
  const spendable = filterSpendable(txns)
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