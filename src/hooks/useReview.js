import { useState, useEffect, useCallback } from 'react'
import { fetchUncategorized, updateTransactionCategory } from '@/data/transactions'
import { fetchChildCategories } from '@/data/categories'

export function useReview() {
  const [txns, setTxns]             = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const [uncategorized, cats] = await Promise.all([fetchUncategorized(), fetchChildCategories()])
    setTxns(uncategorized)
    setCategories(cats)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveCategory = useCallback(async (txId, categoryId) => {
    setSaving(s => ({ ...s, [txId]: true }))
    try {
      await updateTransactionCategory(txId, Number(categoryId))
      setTxns(prev => prev.filter(t => t.id !== txId))
    } finally {
      setSaving(s => ({ ...s, [txId]: false }))
    }
  }, [])

  return { txns, categories, loading, saving, saveCategory }
}