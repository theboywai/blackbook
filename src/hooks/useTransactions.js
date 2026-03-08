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

      // Build category map so parent categories can be attached quickly.
      const catMap = Object.fromEntries(cats.map(c => [c.id, c]))

      // Preserve existing analytics contract: tx.categories.parent?.name.
      const enriched = data.map(tx => {
        if (tx.categories) {
          const parent = catMap[tx.categories.parent_id] || null
          tx.categories.parent = parent ? { id: parent.id, name: parent.name } : null
        }
        return tx
      })

 //     console.log('loaded:', enriched.length, enriched[0]?.categories)
      setTxns(enriched)
    } catch (e) {
   //   console.error('fetch error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { txns, loading, error, refresh: load }
}