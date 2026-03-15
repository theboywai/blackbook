import { useState, useEffect, useCallback } from 'react'
import { fetchTransactions } from '@/data/transactions'
import { fetchCategories } from '@/data/categories'

export function useTransactions() {
  const [txns, setTxns]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, cats] = await Promise.all([fetchTransactions(), fetchCategories()])

      // Build id → category map for parent lookup
      const catMap = {}
      cats.forEach(c => { catMap[c.id] = c })

      // Enrich each transaction with categories.parent
      const enriched = data.map(tx => {
        if (!tx.categories) return tx
        const parent = tx.categories.parent_id ? catMap[tx.categories.parent_id] : null
        return {
          ...tx,
          categories: {
            ...tx.categories,
            parent: parent ? { id: parent.id, name: parent.name } : null,
          }
        }
      })

      setTxns(enriched)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { txns, loading, error, refresh: load }
}