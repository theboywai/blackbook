import { useState, useEffect, useCallback } from 'react'
import { fetchBudgets, updateBudget } from '@/data/budgets'

export function useBudgets() {
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState({})
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBudgets(await fetchBudgets())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (category, amount) => {
    const parsed = parseInt(amount, 10)
    if (isNaN(parsed) || parsed < 0) return
    setSaving(s => ({ ...s, [category]: true }))
    setBudgets(prev => prev.map(b => b.category === category ? { ...b, amount: parsed } : b))
    try {
      await updateBudget(category, parsed)
    } catch (e) {
      setError(e.message)
      load()
    } finally {
      setSaving(s => ({ ...s, [category]: false }))
    }
  }, [load])

  return {
    budgets,
    budgetMap: Object.fromEntries(budgets.map(b => [b.category, b.amount])),
    loading, saving, error, save,
  }
}