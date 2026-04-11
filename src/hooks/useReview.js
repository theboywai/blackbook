import { useState, useEffect, useCallback } from 'react'
import { fetchUncategorized, fetchSplitFlagged, updateTransactionCategory } from '@/data/transactions'
import { fetchChildCategories } from '@/data/categories'
import { fetchOpenSplits } from '@/data/splits'

export function useReview() {
  const [uncategorized, setUncategorized] = useState([])
  const [splitTxns, setSplitTxns]         = useState([])
  const [openSplits, setOpenSplits]       = useState([])
  const [categories, setCategories]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const [uncategorized, splitFlagged, cats, splits] = await Promise.all([
      fetchUncategorized(),
      fetchSplitFlagged(),
      fetchChildCategories(),
      fetchOpenSplits(),
    ])
    setUncategorized(uncategorized)
    setSplitTxns(splitFlagged)
    setCategories(cats)
    setOpenSplits(splits)
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

  const refreshSplits = useCallback(async () => {
    const [splitFlagged, splits] = await Promise.all([fetchSplitFlagged(), fetchOpenSplits()])
    setSplitTxns(splitFlagged)
    setOpenSplits(splits)
  }, [])

  return {
    txns: uncategorized,
    splitTxns,
    openSplits,
    categories,
    loading,
    saving,
    saveCategory,
    removeSplitTxn,
    refreshSplits,
  }
}