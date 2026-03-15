import { useState, useEffect, useMemo } from 'react'
import { fetchOwnAccounts, fetchClosingBalances, fetchLastUploadPerAccount } from '@/data/accounts'
import { accountSummaries, totalCorpus, totalMTD } from '@/analytics/corpus'

export function useCorpus(txns) {
  const [accounts, setAccounts]               = useState([])
  const [closingBalances, setClosingBalances] = useState({})
  const [lastUploads, setLastUploads]         = useState({})
  const [loading, setLoading]                 = useState(true)

  useEffect(() => {
    Promise.all([
      fetchOwnAccounts(),
      fetchClosingBalances(),
      fetchLastUploadPerAccount(),
    ]).then(([accs, balances, uploads]) => {
      setAccounts(accs)
      setClosingBalances(balances)
      setLastUploads(uploads)
      setLoading(false)
    })
  }, [])

  const data = useMemo(() => {
    if (!accounts.length) return null
    return {
      summaries: accountSummaries(txns, accounts, closingBalances, lastUploads),
      corpus:    totalCorpus(closingBalances),
      mtd:       totalMTD(txns),
    }
  }, [txns, accounts, closingBalances, lastUploads])

  return { data, loading }
}