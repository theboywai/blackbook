import { useState, useEffect, useCallback } from 'react'
import { fetchUncategorized, fetchSplitFlagged, fetchSplitCredits, updateTransactionCategory } from '@/data/transactions'
import { fetchChildCategories } from '@/data/categories'
import { supabase } from '@/lib/supabase'

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

    // Filter out any split txns whose split is already settled/written_off.
    // This guards against is_split being true on DB while status is settled
    // (e.g. manually settled on DB without clearing is_split).
    const openIds = new Set()
    if (splitFlagged.length > 0) {
      const splitIds = splitFlagged
        .map(t => t.split_id)
        .filter(Boolean)
      if (splitIds.length > 0) {
        const { data: openSplits } = await supabase
          .from('splits')
          .select('id')
          .in('id', splitIds)
          .eq('status', 'open')
        ;(openSplits || []).forEach(s => openIds.add(s.id))
      }
      // Keep txns that either have no split_id yet (setup mode) or whose split is open
      setSplitTxns(splitFlagged.filter(t => !t.split_id || openIds.has(t.split_id)))
    } else {
      setSplitTxns([])
    }

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

  const refreshSplits = useCallback(async () => {
    const [splitFlagged, credits] = await Promise.all([
      fetchSplitFlagged(),
      fetchSplitCredits(),
    ])

    if (splitFlagged.length > 0) {
      const splitIds = splitFlagged.map(t => t.split_id).filter(Boolean)
      if (splitIds.length > 0) {
        const { data: openSplits } = await supabase
          .from('splits')
          .select('id')
          .in('id', splitIds)
          .eq('status', 'open')
        const openIds = new Set((openSplits || []).map(s => s.id))
        setSplitTxns(splitFlagged.filter(t => !t.split_id || openIds.has(t.split_id)))
      } else {
        setSplitTxns(splitFlagged)
      }
    } else {
      setSplitTxns([])
    }

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