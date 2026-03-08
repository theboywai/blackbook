import { useState, useEffect, useMemo } from 'react'
import { fetchOwnAccounts, fetchClosingBalances } from '@/data/accounts'
import { accountSummaries, totalCorpus, totalMTD } from '@/analytics/corpus'

export function useCorpus(txns) {
  const [accounts, setAccounts]               = useState([])
  const [closingBalances, setClosingBalances] = useState({})
  const [loading, setLoading]                 = useState(true)

  useEffect(() => {
    Promise.all([fetchOwnAccounts(), fetchClosingBalances()]).then(([accs, balances]) => {
      setAccounts(accs)
      setClosingBalances(balances)
      setLoading(false)
    })
  }, [])

  const data = useMemo(() => {
    if (!txns.length || !accounts.length) return null
    return {
      summaries: accountSummaries(txns, accounts, closingBalances),
      corpus:    totalCorpus(closingBalances),
      mtd:       totalMTD(txns),
    }
  }, [txns, accounts, closingBalances])

  return { data, loading }
}