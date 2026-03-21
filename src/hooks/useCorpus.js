import { useState, useEffect, useMemo } from 'react'
import { fetchOwnAccounts, fetchLastUploadPerAccount } from '@/data/accounts'
import { accountSummaries, totalCorpus, totalMTD } from '@/analytics/corpus'

export function useCorpus(txns) {
  const [accounts, setAccounts]       = useState([])
  const [lastUploads, setLastUploads] = useState({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    Promise.all([
      fetchOwnAccounts(),
      fetchLastUploadPerAccount(),
    ]).then(([accs, uploads]) => {
      setAccounts(accs)
      setLastUploads(uploads)
      setLoading(false)
    })
  }, [])

  const data = useMemo(() => {
    if (!accounts.length) return null
    return {
      summaries: accountSummaries(txns, accounts, lastUploads),
      corpus:    totalCorpus(accounts),
      mtd:       totalMTD(txns),
    }
  }, [txns, accounts, lastUploads])

  return { data, loading }
}