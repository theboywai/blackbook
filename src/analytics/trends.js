import { filterByDateRange, totalSpend, spendByParentCategory } from './spend'

export function getMonthRange(offset = 0) {
  const now   = new Date()
  const month = now.getMonth() + offset
  const start = new Date(now.getFullYear(), month, 1)
  const end   = new Date(now.getFullYear(), month + 1, 0)
  return {
    from:        start.toISOString().slice(0, 10),
    to:          end.toISOString().slice(0, 10),
    label:       start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase(),
    daysInMonth: end.getDate(),
  }
}

export function getCurrentWeekRange() {
  const now = new Date()
  const day = now.getDay() || 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - day + 1)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return {
    from:  mon.toISOString().slice(0, 10),
    to:    sun.toISOString().slice(0, 10),
    label: 'THIS WEEK',
  }
}

export function getLastWeekRange() {
  const curr = getCurrentWeekRange()
  const from = new Date(curr.from)
  const to   = new Date(curr.to)
  from.setDate(from.getDate() - 7)
  to.setDate(to.getDate() - 7)
  return {
    from:  from.toISOString().slice(0, 10),
    to:    to.toISOString().slice(0, 10),
    label: 'LAST WEEK',
  }
}

export function comparePeriods(txns, currentRange, previousRange) {
  const curr     = totalSpend(filterByDateRange(txns, currentRange.from, currentRange.to))
  const prev     = totalSpend(filterByDateRange(txns, previousRange.from, previousRange.to))
  const delta    = curr - prev
  return {
    current:      Math.round(curr),
    previous:     Math.round(prev),
    delta:        Math.round(delta),
    deltaPercent: prev > 0 ? Math.round((delta / prev) * 100) : null,
    direction:    delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
  }
}

export function weeklySpendHistory(txns, weeks = 6) {
  const result = []
  const curr   = getCurrentWeekRange()
  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(curr.from)
    const to   = new Date(curr.to)
    from.setDate(from.getDate() - i * 7)
    to.setDate(to.getDate() - i * 7)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr   = to.toISOString().slice(0, 10)
    const slice   = filterByDateRange(txns, fromStr, toStr)
    const label   = from.toLocaleString('en-IN', { month: 'short', day: 'numeric' })
    result.push({ label, amount: Math.round(totalSpend(slice)), from: fromStr, to: toStr })
  }
  return result
}

export function categoryTrends(txns) {
  const curr     = getMonthRange(0)
  const prev     = getMonthRange(-1)
  const currBycat = Object.fromEntries(spendByParentCategory(filterByDateRange(txns, curr.from, curr.to)).map(c => [c.name, c.amount]))
  const prevBycat = Object.fromEntries(spendByParentCategory(filterByDateRange(txns, prev.from, prev.to)).map(c => [c.name, c.amount]))
  const allNames  = new Set([...Object.keys(currBycat), ...Object.keys(prevBycat)])
  return [...allNames].map(name => {
    const current  = currBycat[name] || 0
    const previous = prevBycat[name] || 0
    const delta    = current - previous
    return { name, current, previous, delta, deltaPercent: previous > 0 ? Math.round((delta / previous) * 100) : null }
  }).sort((a, b) => b.current - a.current)
}