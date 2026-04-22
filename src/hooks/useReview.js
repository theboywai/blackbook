import { useState, useEffect, useCallback } from 'react'
import { fetchUncategorized, fetchSplitFlagged, fetchSplitCredits, updateTransactionCategory } from '@/data/transactions'
import { fetchChildCategories } from '@/data/categories'

export function useReview() {
  const [uncategorized, setUncategorized] = useState([])
  const [splitTxns, setSplitTxns]         = useState([])
  const [splitCredits, setSplitCredits]   = useState([])
  const [categories, setCategories]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const [uncategorized, splitFlagged, credits, cats] = await Promise.all([
      fetchUncategorized(),
      fetchSplitFlagged(),
      fetchSplitCredits(),
      fetchChildCategories(),
    ])
    setUncategorized(uncategorized)
    setSplitTxns(splitFlagged)
    setSplitCredits(credits)
    setCategories(cats)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveCategory = useCallback(async (txId, categoryId) => {
    setSaving(s => ({ ...s, [txId]: true }))
    try {
      await updateTransactionCategory(txId, Number(categoryId))
      setUncategorized(prev => prev.filter(t => t.id !== txId))
    } finally {
      setSaving(s => ({ ...s, [txId]: false }))
    }
  }, [])

  const removeSplitTxn = useCallback((txId) => {
    setSplitTxns(prev => prev.filter(t => t.id !== txId))
  }, [])

  // Full refresh of split-related state (debits + credits)
  const refreshSplits = useCallback(async () => {
    const [splitFlagged, credits] = await Promise.all([
      fetchSplitFlagged(),
      fetchSplitCredits(),
    ])
    setSplitTxns(splitFlagged)
    setSplitCredits(credits)
  }, [])

  return {
    txns: uncategorized,
    splitTxns,
    splitCredits,
    categories,
    loading,
    saving,
    saveCategory,
    removeSplitTxn,
    refreshSplits,
  }
}